import { useState } from 'react';
import { Pencil, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface NotesCardProps {
  notes: string | undefined;
  onSave: (notes: string) => void;
}

export function NotesCard({ notes, onSave }: NotesCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(notes || '');

  const handleEdit = () => {
    setEditValue(notes || '');
    setIsEditing(true);
  };

  const handleSave = () => {
    onSave(editValue);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(notes || '');
    setIsEditing(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Notities</CardTitle>
          {!isEditing && (
            <Button variant="ghost" size="sm" onClick={handleEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              Bewerken
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder="Voeg notities toe..."
              rows={4}
              autoFocus
            />
            <div className="flex items-center gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Annuleren
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Save className="h-4 w-4 mr-1" />
                Opslaan
              </Button>
            </div>
          </div>
        ) : notes ? (
          <p className="whitespace-pre-wrap">{notes}</p>
        ) : (
          <p className="text-muted-foreground italic">Geen notities</p>
        )}
      </CardContent>
    </Card>
  );
}
