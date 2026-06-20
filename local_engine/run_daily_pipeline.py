import os
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase import create_client, Client
from loguru import logger
import collectors.bhavcopy
import collectors.news_rss
import collectors.fundamentals
import collectors.macro
import sentiment.finbert_local
import features.build_feature_matrix
import signals.signal_generator
import backtest.outcome_tracker

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

# Initialize Supabase client
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("Supabase URL or Key is missing in .env file.")
    exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

def run_pipeline():
    today = datetime.now()
    trade_date_str = today.strftime("%d-%m-%Y")
    pg_date_str = today.strftime("%Y-%m-%d")
    
    logger.info(f"Starting daily pipeline for {trade_date_str}")
    
    # Insert initial run record
    try:
        run_record = supabase.table("pipeline_runs").insert({
            "run_date": pg_date_str,
            "started_at": datetime.now().isoformat(),
            "status": "RUNNING"
        }).execute()
        run_id = run_record.data[0]['id']
        logger.info(f"Created pipeline_run record with ID: {run_id}")
    except Exception as e:
        logger.error(f"Failed to create pipeline_runs record: {e}")
        return
        
    # Phase 1: Bhavcopy
    bhavcopy_success = False
    max_retries = 3
    retry_delay_sec = 5  # Short for testing; in prod might be 300 (5 mins)
    
    for attempt in range(1, max_retries + 1):
        logger.info(f"Running Bhavcopy Collector (Attempt {attempt}/{max_retries})")
        
        try:
            bhavcopy_success = collectors.bhavcopy.fetch_and_store_bhavcopy(trade_date_str)
        except Exception as e:
            logger.error(f"Unexpected crash in bhavcopy collector: {e}")
            bhavcopy_success = False
            
        if bhavcopy_success:
            logger.info("Bhavcopy collection successful.")
            break
        else:
            logger.warning(f"Bhavcopy collection failed on attempt {attempt}.")
            if attempt < max_retries:
                logger.info(f"Waiting {retry_delay_sec} seconds before retrying...")
                time.sleep(retry_delay_sec)
                
    # Phase 2: News RSS
    logger.info("Running News RSS Collector")
    try:
        news_success = collectors.news_rss.run_news_collector()
    except Exception as e:
        logger.error(f"Unexpected crash in News RSS collector: {e}")
        news_success = False

    # Phase 3: FinBERT Sentiment
    if news_success:
        logger.info("Running FinBERT local inference")
        try:
            finbert_success = sentiment.finbert_local.run_finbert_inference()
        except Exception as e:
            logger.error(f"Unexpected crash in FinBERT inference: {e}")
            finbert_success = False
    else:
        logger.warning("Skipping FinBERT inference because News RSS collection failed.")
        finbert_success = False

    # Phase 3.5: Macro Data
    logger.info("Running Macro Collector (yfinance)")
    try:
        # Fetching 1 month of macro just to ensure daily updates are solid.
        # backfill_macro is used for 24 months. For daily, 1 month is plenty since it upserts.
        collectors.macro.fetch_macro_data(1)
        macro_success = True
    except Exception as e:
        logger.error(f"Unexpected crash in Macro Collector: {e}")
        macro_success = False
                
    # Phase 4: Fundamentals (Weekly, with catch-up logic)
    fundamentals_success = True  # Default to true so it doesn't fail the pipeline if skipped
    logger.info("Checking Fundamentals collector schedule...")
    try:
        # Get max as_of_date from fundamentals_weekly
        fund_res = supabase.table("fundamentals_weekly").select("as_of_date").order("as_of_date", desc=True).limit(1).execute()
        
        days_since_last_run = 999  # Default to large if no records exist
        if fund_res.data:
            last_date_str = fund_res.data[0]['as_of_date']
            last_date = datetime.strptime(last_date_str, "%Y-%m-%d").date()
            days_since_last_run = (today.date() - last_date).days
            
        if today.weekday() == 6 or days_since_last_run >= 7:
            logger.info(f"Running fundamentals scrape (Sunday or {days_since_last_run} days stale)...")
            fundamentals_success = collectors.fundamentals.fetch_and_store_fundamentals()
        else:
            logger.info(f"Skipping fundamentals. Last run {days_since_last_run} days ago.")
            
    except Exception as e:
        logger.error(f"Unexpected crash in Fundamentals orchestration: {e}")
        fundamentals_success = False

    # Phase 5: Feature Engineering
    logger.info("Building Daily Feature Matrix...")
    try:
        features_success = features.build_feature_matrix.build_feature_matrix()
    except Exception as e:
        logger.error(f"Unexpected crash in Feature Engineering: {e}")
        features_success = False
                
    # Phase 6: Signal Generation
    logger.info("Generating Trading Signals...")
    try:
        signals_success = signals.signal_generator.generate_signals()
    except Exception as e:
        logger.error(f"Unexpected crash in Signal Generation: {e}")
        signals_success = False
        
    # Phase 7: Outcome Tracking (for T-5 forecasts)
    logger.info("Tracking Outcomes for T-5 forecasts...")
    try:
        outcomes_success = backtest.outcome_tracker.track_outcomes()
    except Exception as e:
        logger.error(f"Unexpected crash in Outcome Tracking: {e}")
        outcomes_success = False

    # Phase 8 (NEW): Aarthi AI Long-Term Signals
    try:
        logger.info("Starting Aarthi AI long-term signal generation...")
        import longterm.generate_longterm_signals
        longterm.generate_longterm_signals.generate_longterm_signals_for_today()
        logger.info("Aarthi AI signal generation complete.")
    except Exception as e:
        logger.error(f"Aarthi AI phase FAILED (short-term system unaffected): {e}")

    # Evaluate Pipeline Status
    if bhavcopy_success and news_success and finbert_success and fundamentals_success and macro_success and features_success and signals_success and outcomes_success:
        final_status = "SUCCESS"
        error_log = ""
    else:
        final_status = "FAILED"
        if not bhavcopy_success:
            error_log = "Bhavcopy download failed after maximum retries. "
        elif not news_success or not finbert_success:
            error_log = "Bhavcopy succeeded, but News/FinBERT pipeline failed. "
        else:
            error_log = "Bhavcopy and News succeeded, but Fundamentals collection failed."
        
    logger.info(f"Pipeline finished with status: {final_status}")
    
    # Update pipeline_runs
    try:
        supabase.table("pipeline_runs").update({
            "finished_at": datetime.now().isoformat(),
            "status": final_status,
            "error_log": error_log
        }).eq("id", run_id).execute()
        logger.info("Successfully updated pipeline_runs record.")
    except Exception as e:
        logger.error(f"Failed to update pipeline_runs record: {e}")

if __name__ == "__main__":
    run_pipeline()
