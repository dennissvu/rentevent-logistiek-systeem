import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, User, Phone, Truck } from 'lucide-react';
import { Driver } from '@/data/planningData';

interface DriversListProps {
  drivers: Driver[];
  onAdd: (driver: Omit<Driver, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<Driver>) => void;
  onDelete: (id: string) => void;
}

export function DriversList({ drivers, onAdd, onUpdate, onDelete }: DriversListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [available, setAvailable] = useState(true);
  const [canDriveTrailer, setCanDriveTrailer] = useState(true);

  const resetForm = () => {
    setName('');
    setPhone('');
    setAvailable(true);
    setCanDriveTrailer(true);
    setEditingDriver(null);
  };

  const openAddDialog = () => {
    resetForm();
    setIsDialogOpen(true);
  };

  const openEditDialog = (driver: Driver) => {
    setEditingDriver(driver);
    setName(driver.name);
    setPhone(driver.phone);
    setAvailable(driver.available);
    setCanDriveTrailer(driver.canDriveTrailer);
    setIsDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!name.trim()) return;

    if (editingDriver) {
      onUpdate(editingDriver.id, {
        name: name.trim(),
        phone: phone.trim(),
        available,
        canDriveTrailer,
      });
    } else {
      onAdd({
        name: name.trim(),
        phone: phone.trim(),
        available,
        canDriveTrailer,
      });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = () => {
    if (deleteId) {
      onDelete(deleteId);
      setDeleteId(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Alle chauffeurs ({drivers.length})</CardTitle>
          <Button onClick={openAddDialog} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Toevoegen
          </Button>
        </CardHeader>
        <CardContent>
          {drivers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nog geen chauffeurs. Voeg er een toe!
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Naam</TableHead>
                  <TableHead>Telefoon</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Aanhanger</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drivers.map((driver) => (
                  <TableRow key={driver.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        {driver.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        {driver.phone || '-'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={driver.available ? 'default' : 'secondary'}>
                        {driver.available ? 'Beschikbaar' : 'Niet beschikbaar'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={driver.canDriveTrailer ? 'default' : 'outline'}>
                          {driver.canDriveTrailer ? 'Ja' : 'Nee'}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(driver)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(driver.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDriver ? 'Chauffeur bewerken' : 'Chauffeur toevoegen'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam *</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Naam van de chauffeur" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Telefoon</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="06-12345678" />
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="available">Beschikbaar</Label>
              <Switch id="available" checked={available} onCheckedChange={setAvailable} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="canDriveTrailer">Mag met aanhanger rijden</Label>
                <p className="text-sm text-muted-foreground">Geef aan of deze chauffeur met aanhanger mag rijden</p>
              </div>
              <Switch id="canDriveTrailer" checked={canDriveTrailer} onCheckedChange={setCanDriveTrailer} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Annuleren</Button>
            <Button onClick={handleSubmit} disabled={!name.trim()}>
              {editingDriver ? 'Opslaan' : 'Toevoegen'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Chauffeur verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze chauffeur wilt verwijderen? Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
