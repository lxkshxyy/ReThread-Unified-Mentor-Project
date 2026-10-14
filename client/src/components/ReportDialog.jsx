import { useState } from 'react';
import toast from 'react-hot-toast';
import { Modal } from './ui';
import { api, errorMessage } from '@/lib/api';
import { REPORT_REASONS } from '@shared/catalog.js';

export default function ReportDialog({ open, onClose, targetType, targetId, name }) {
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!reason) return toast.error('Choose a reason');
    setBusy(true);
    try {
      await api.post('/reports', { targetType, targetId, reason, details });
      toast.success('Thanks — our moderators will review this');
      onClose();
      setReason('');
      setDetails('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title={`Report ${targetType === 'item' ? 'listing' : 'member'}`}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-muted">Tell us what’s wrong with “{name}”. Reports are anonymous to the other member.</p>
        <div className="space-y-2">
          {REPORT_REASONS.map((r) => (
            <label key={r.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-line px-3 py-2.5 text-sm has-[:checked]:border-moss has-[:checked]:bg-moss-soft/40">
              <input type="radio" name="reason" value={r.key} checked={reason === r.key} onChange={() => setReason(r.key)} className="accent-[rgb(var(--moss))]" />
              {r.label}
            </label>
          ))}
        </div>
        <textarea className="input min-h-[90px]" maxLength={500} placeholder="Anything else we should know? (optional)" value={details} onChange={(e) => setDetails(e.target.value)} />
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</button>
        </div>
      </form>
    </Modal>
  );
}
