import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus } from 'lucide-react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '~/components/ui/dialog';
import { Input } from '~/components/ui/input';
import { Field } from '~/components/field';
import { ErrorNote } from './ui';
import { errorMessage } from '~/lib/api';
import { adminApi, adminKeys } from '~/lib/admin-api';

/** A title is all an activity needs to exist; everything else happens in the builder. */
export function NewActivityButton({ size = 'default' }: { size?: 'default' | 'sm' }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: () => adminApi.create(title.trim()),
    onSuccess: (a) => {
      qc.setQueryData(adminKeys.activity(a._id), a);
      void qc.invalidateQueries({ queryKey: adminKeys.activities });
      setOpen(false);
      setTitle('');
      navigate(`/admin/activities/${a._id}`);
    },
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Plus /> New activity
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim()) create.mutate();
          }}
        >
          <DialogHeader>
            <DialogTitle>New activity</DialogTitle>
            <DialogDescription>The name employees will see. You can change it later.</DialogDescription>
          </DialogHeader>
          <Field label="Name" className="mt-5">
            {(p) => <Input {...p} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Spot the Phish: Week 2" maxLength={200} />}
          </Field>
          {create.error ? <ErrorNote className="mt-4">{errorMessage(create.error)}</ErrorNote> : null}
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
