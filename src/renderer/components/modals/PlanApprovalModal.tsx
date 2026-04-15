import React, { memo } from 'react'

interface PlanApprovalModalProps {
  plan: string
  onApprove: () => void
  onReject: () => void
}

const PlanApprovalModal = memo(({ plan, onApprove, onReject }: PlanApprovalModalProps) => (
  <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
    <div className="w-[500px] bg-slate-900 border border-slate-700/50 rounded-2xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300">
      <div className="p-6 bg-slate-800/30 border-b border-white/5">
        <div className="flex items-center gap-3 mb-2">
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
          <h2 className="text-white font-black text-xs uppercase tracking-[0.2em]">Execution Plan Approval</h2>
        </div>
        <p className="text-slate-400 text-xs leading-relaxed">
          The agent has proposed a plan. Please review the steps below before proceeding.
        </p>
      </div>

      <div className="p-6 max-h-[300px] overflow-y-auto custom-scrollbar">
        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
          {plan}
        </div>
      </div>

      <div className="p-6 bg-slate-800/30 border-t border-white/5 flex gap-3">
        <button
          onClick={onReject}
          className="flex-1 py-3 px-4 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 text-xs font-bold hover:bg-rose-500/20 transition-all active:scale-95"
        >
          Reject Plan
        </button>
        <button
          onClick={onApprove}
          className="flex-1 py-3 px-4 rounded-xl border border-emerald-500/30 bg-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/30 transition-all shadow-lg shadow-emerald-500/10 active:scale-95"
        >
          Approve & Execute
        </button>
      </div>
    </div>
  </div>
))

PlanApprovalModal.displayName = 'PlanApprovalModal'

export default PlanApprovalModal
