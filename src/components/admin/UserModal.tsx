import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';

const UserModal = ({ open, onOpenChange, user, onSaved }: any) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setPhone(user.phone || '');
      setPassword('');
      setRoleId(user.role_id || null);
    } else {
      setName(''); setEmail(''); setPhone(''); setRoleId(null);
    }
    fetchRoles();
  }, [user]);

  const fetchRoles = async () => {
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const resp = await apiFetch('/api/admin/roles', { headers });
      if (!resp.ok) return setRoles([]);
      const payload = await resp.json();
      setRoles(payload.data || []);
    } catch (err) {
      setRoles([]);
    }
  };

  const handleSave = async () => {
    if (!name || !email) return toast.error('Nom et email requis');
    try {
      const token = localStorage.getItem('sessionToken');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      if (user && user.id) {
        // include password only if provided when updating
        const payload: any = { name, email, phone, role_id: roleId };
        if (password && password.trim() !== '') payload.password = password;
        const resp = await apiFetch(`/api/admin/users/${user.id}`, { method: 'PUT', headers, body: JSON.stringify(payload) });
        if (!resp.ok) throw new Error('update failed');
        toast.success('Utilisateur mis à jour');
      } else {
        const resp = await apiFetch('/api/admin/users', { method: 'POST', headers, body: JSON.stringify({ name, email, phone, role_id: roleId, password: password || 'changeme' }) });
        if (!resp.ok) throw new Error('create failed');
        toast.success('Utilisateur créé');
      }
      onSaved?.();
    } catch (err) {
      console.error(err);
      toast.error('Erreur lors de l\'enregistrement');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? 'Modifier utilisateur' : 'Créer utilisateur'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div>
            <label className="block text-sm">Nom</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm">Email</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm">Téléphone</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm">Mot de passe {user ? '(laisser vide pour ne pas changer)' : ''}</label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm">Rôle</label>
            <Select onValueChange={(v) => setRoleId(v)} value={roleId || ''}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un rôle" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button onClick={handleSave}>{user ? 'Sauvegarder' : 'Créer'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UserModal;
