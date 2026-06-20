import React from 'react';
import { ArrowLeft, BookOpen, ShieldAlert, BarChart3, Database } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import HonestyBanner from '../../components/longterm/HonestyBanner';

export default function Methodology() {
  const navigate = useNavigate();

  return (
    <div className="p-6 max-w-4xl mx-auto pb-24">
      <div className="mb-6">
        <h1 className="text-3xl font-display text-[var(--text-primary)] mb-2 flex items-center space-x-3">
          <BookOpen className="w-8 h-8 text-[var(--color-positive)]" />
          <span>Ranking Methodology</span>
        </h1>
        <p className="text-[var(--text-secondary)] font-data text-sm">
          Aarthi AI Long-Term (60-Day) Model Specifications
        </p>
      </div>

      <HonestyBanner />

      <div className="space-y-8 mt-8">
        <section className="bg-[var(--bg-card)] border border-[var(--text-caption)]/20 rounded-xl p-6 md:p-8">
          <h2 className="text-2xl font-display text-[var(--text-primary)] mb-6 flex items-center space-x-2">
            <BookOpen className="w-6 h-6 text-blue-500" />
            <span>Mode Comparison</span>
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm font-data">
              <thead>
                <tr className="border-b border-[var(--text-caption)]/20">
                  <th className="py-3 px-4 text-[var(--text-secondary)] font-label uppercase tracking-wider">Feature</th>
                  <th className="py-3 px-4 text-blue-400 font-display text-base">Short-Term Mode</th>
                  <th className="py-3 px-4 text-emerald-400 font-display text-base">Long-Term Mode</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--text-caption)]/10 text-[var(--text-primary)]">
                <tr>
                  <td className="py-4 px-4 font-label text-[var(--text-secondary)]">Time Horizon</td>
                  <td className="py-4 px-4">5 Trading Days (~1 week)</td>
                  <td className="py-4 px-4">60 Trading Days (~3 months)</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-label text-[var(--text-secondary)]">What It Predicts</td>
                  <td className="py-4 px-4">Specific Price/Return Forecast (Quantile Regression)</td>
                  <td className="py-4 px-4">Relative Ranking against peers (LambdaRank)</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-label text-[var(--text-secondary)]">Primary Inputs</td>
                  <td className="py-4 px-4">Technicals, NLP Sentiment, Snapshot Fundamentals</td>
                  <td className="py-4 px-4">Price Momentum, Volatility, Institutional Delivery</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-label text-[var(--text-secondary)]">Validation Status</td>
                  <td className="py-4 px-4"><span className="text-emerald-400">Production-Ready.</span> Real walk-forward backtests show ~49% win rate edge openly disclosed.</td>
                  <td className="py-4 px-4"><span className="text-amber-400">Experimental.</span> Single-fold backtest lacked sufficient edge; disclosed clearly as challenger status.</td>
                </tr>
                <tr>
                  <td className="py-4 px-4 font-label text-[var(--text-secondary)]">Best Used For</td>
                  <td className="py-4 px-4">Short-term trade timing and tactical entries/exits.</td>
                  <td className="py-4 px-4">Identifying stocks with strong recent price/participation profiles for deeper research.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-[var(--bg-card)] border border-[var(--text-caption)]/20 rounded-xl p-6 md:p-8">
          <h2 className="text-2xl font-display text-[var(--text-primary)] mb-4 flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-emerald-500" />
            <span>The 3 Core Ranking Factors</span>
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed mb-6 font-data text-sm">
            Our current long-term model generates predictive composite scores using a LightGBM `lambdarank` algorithm trained on ~24 months of historical pricing data. The current live model evaluates stocks across three technical dimensions:
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-[#1a1612] p-5 rounded-lg border border-[var(--text-caption)]/10">
              <h3 className="text-lg font-display text-white mb-2">Momentum</h3>
              <p className="text-sm text-[var(--text-caption)] leading-relaxed">
                Evaluates a stock's 6-month (126-day) raw return relative to the cross-sectional universe. Captures persistent medium-term trends.
              </p>
            </div>
            <div className="bg-[#1a1612] p-5 rounded-lg border border-[var(--text-caption)]/10">
              <h3 className="text-lg font-display text-white mb-2">Low Volatility</h3>
              <p className="text-sm text-[var(--text-caption)] leading-relaxed">
                Inverts the 60-day realized annualized volatility. The model rewards stable, smooth price action and penalizes erratic swings.
              </p>
            </div>
            <div className="bg-[#1a1612] p-5 rounded-lg border border-[var(--text-caption)]/10">
              <h3 className="text-lg font-display text-white mb-2">Delivery</h3>
              <p className="text-sm text-[var(--text-caption)] leading-relaxed">
                Measures the 20-day exponential moving average of NSE delivery percentages, capturing institutional accumulation vs. intraday speculation.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-[var(--bg-card)] border border-[var(--text-caption)]/20 rounded-xl p-6 md:p-8">
          <h2 className="text-2xl font-display text-[var(--text-primary)] mb-4 flex items-center space-x-2">
            <Database className="w-6 h-6 text-amber-500" />
            <span>Fundamental Factors (Display Only)</span>
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed font-data text-sm">
            We track two critical fundamental factors: <strong>Value</strong> (Trailing P/E) and <strong>Quality</strong> (Return on Equity). However, because we only began aggregating weekly snapshot fundamentals recently, we lack the deep historical dataset required to train our machine learning models on these metrics without introducing severe lookahead bias.
          </p>
          <div className="mt-4 p-4 bg-amber-500/5 border border-amber-500/10 rounded-lg text-amber-200/80 text-sm italic">
            Currently, Value and Quality are tracked for display and manual review only. They do not yet influence the model's composite score or ranking. Once sufficient historical fundamental data is accrued, they will be promoted to active model features.
          </div>
        </section>

        <section className="bg-[var(--bg-card)] border border-[var(--text-caption)]/20 rounded-xl p-6 md:p-8">
          <h2 className="text-2xl font-display text-[var(--text-primary)] mb-4 flex items-center space-x-2">
            <ShieldAlert className="w-6 h-6 text-red-400" />
            <span>Risk Gates</span>
          </h2>
          <p className="text-[var(--text-secondary)] leading-relaxed mb-4 font-data text-sm">
            Before any stock is ranked, it must pass rigid "Hard Gates" to ensure basic tradability and financial safety. Stocks failing these gates are scored but stripped of their rank.
          </p>
          <ul className="space-y-3">
            <li className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
              <div className="text-[var(--text-primary)] text-sm">
                <strong>Liquidity Gate:</strong> 30-day average daily turnover must exceed ₹500,000 to prevent slippage in low-volume equities.
              </div>
            </li>
            <li className="flex items-start space-x-3">
              <div className="w-2 h-2 rounded-full bg-red-500 mt-2 flex-shrink-0" />
              <div className="text-[var(--text-primary)] text-sm">
                <strong>Leverage Gate:</strong> Debt-to-Equity (D/E) ratio must be 2.0 or lower. Highly leveraged companies are deemed too risky for the standard model.
              </div>
            </li>
          </ul>
        </section>

      </div>
    </div>
  );
}
