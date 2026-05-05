'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { listMyChildren, createVisitRequest, type VisitUrgency } from '@/lib/api/parent';

const SYMPTOM_OPTIONS = [
  'Fever', 'Diarrhoea', 'Vomiting', 'Cough', 'Difficulty breathing',
  'Rash', 'Swollen limbs', 'Not eating', 'Lethargic / weak', 'Other',
];

const schema = z.object({
  child: z.string().min(1, 'Select a child'),
  urgency: z.enum(['ROUTINE', 'SOON', 'URGENT'] as const),
  concern_text: z.string().max(1000),
  symptom_flags: z.array(z.string()),
});
type FormValues = z.infer<typeof schema>;

const URGENCY_LABELS: Record<VisitUrgency, { label: string; description: string; color: string }> = {
  ROUTINE: { label: 'Routine', description: 'No immediate concern, general check-up', color: 'border-gray-300 bg-white' },
  SOON: { label: 'Soon', description: 'Within the next week', color: 'border-amber-400 bg-amber-50' },
  URGENT: { label: 'Urgent', description: 'Within 24 hours — child needs immediate attention', color: 'border-red-400 bg-red-50' },
};

export default function RequestVisitPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedChild = searchParams.get('child') ?? '';
  const qc = useQueryClient();

  const { data: children = [], isLoading: loadingChildren } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: async () => {
      const r = await listMyChildren();
      return r.items;
    },
  });

  const { register, control, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { child: preselectedChild, urgency: 'ROUTINE', concern_text: '', symptom_flags: [] },
  });

  const selectedFlags = watch('symptom_flags');

  const mutation = useMutation({
    mutationFn: createVisitRequest,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['parent', 'visit-requests'] });
      router.push('/parent');
    },
  });

  function toggleSymptom(sym: string) {
    const next = selectedFlags.includes(sym)
      ? selectedFlags.filter((s) => s !== sym)
      : [...selectedFlags, sym];
    setValue('symptom_flags', next);
  }

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      child: values.child,
      urgency: values.urgency,
      concern_text: values.concern_text,
      symptom_flags: values.symptom_flags,
    });
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Request a Home Visit</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your assigned Community Health Worker will receive this request.
        </p>
      </div>

      {mutation.isSuccess && (
        <div className="flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 p-4 text-green-800">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span className="text-sm font-medium">Visit request submitted! Your CHW has been notified.</span>
        </div>
      )}

      {mutation.isError && (
        <div className="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-sm">Failed to submit. Please try again.</span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Child select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Child *</label>
          {loadingChildren ? (
            <div className="h-10 animate-pulse bg-gray-100 rounded-md" />
          ) : (
            <select
              {...register('child')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Select a child…</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.full_name}</option>
              ))}
            </select>
          )}
          {errors.child && <p className="mt-1 text-xs text-red-600">{errors.child.message}</p>}
        </div>

        {/* Urgency */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Urgency *</label>
          <Controller
            control={control}
            name="urgency"
            render={({ field }) => (
              <div className="space-y-2">
                {(Object.keys(URGENCY_LABELS) as VisitUrgency[]).map((u) => {
                  const info = URGENCY_LABELS[u];
                  return (
                    <label
                      key={u}
                      className={`flex items-start gap-3 cursor-pointer rounded-lg border-2 p-3 transition-colors ${
                        field.value === u ? info.color + ' ring-2 ring-blue-500' : 'border-gray-200 bg-white hover:bg-gray-50'
                      }`}
                    >
                      <input
                        type="radio"
                        value={u}
                        checked={field.value === u}
                        onChange={() => field.onChange(u)}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{info.label}</p>
                        <p className="text-xs text-gray-500">{info.description}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          />
        </div>

        {/* Symptom checkboxes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Symptoms observed</label>
          <div className="grid grid-cols-2 gap-2">
            {SYMPTOM_OPTIONS.map((sym) => (
              <label
                key={sym}
                className={`flex items-center gap-2 cursor-pointer rounded-md border px-3 py-2 text-sm transition-colors ${
                  selectedFlags.includes(sym)
                    ? 'border-blue-500 bg-blue-50 text-blue-800'
                    : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedFlags.includes(sym)}
                  onChange={() => toggleSymptom(sym)}
                  className="h-4 w-4 rounded border-gray-300 text-blue-600"
                />
                {sym}
              </label>
            ))}
          </div>
        </div>

        {/* Free-text concern */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional details <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            {...register('concern_text')}
            rows={4}
            placeholder="Describe what you've noticed or any other concerns…"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          {errors.concern_text && (
            <p className="mt-1 text-xs text-red-600">{errors.concern_text.message}</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Submit Request
          </button>
        </div>
      </form>
    </div>
  );
}
