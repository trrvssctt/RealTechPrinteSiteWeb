import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

const RolesPage = () => {
  const [roles, setRoles] = useState<any[]>([]);

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    try {
      const resp = await apiFetch('/api/admin/roles');
      if (!resp.ok) throw new Error('no roles');
      const payload = await resp.json();
      setRoles(payload.data || []);
    } catch (err) {
      console.warn('roles fetch failed', err);
      setRoles([]);
    }
  };

  const handleCreate = async () => {
    const name = prompt('Nom du rôle');
    if (!name) return;
    try {
      const resp = await apiFetch('/api/admin/roles', { method: 'POST', body: JSON.stringify({ name }) });
      if (!resp.ok) throw new Error('create failed');
      toast.success('Rôle créé');
      fetchRoles();
    } catch (err) {
      toast.error('Impossible de créer le rôle');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce rôle ?')) return;
    try {
      const resp = await apiFetch(`/api/admin/roles/${id}`, { method: 'DELETE' });
      if (!resp.ok) throw new Error('delete failed');
      toast.success('Rôle supprimé');
      fetchRoles();
    } catch (err) {
      toast.error('Impossible de supprimer le rôle');
    }
  };

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-semibold">Rôles & Permissions</h2>
        <Button onClick={handleCreate}><Plus className="mr-2" size={16}/>Nouveau rôle</Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Liste des rôles</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.description || '-'}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="ghost" onClick={() => alert('TODO: manage permissions for '+r.name)}>Gérer</Button>
                      <Button variant="ghost" onClick={() => handleDelete(r.id)}><Trash2 size={16} /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default RolesPage;
