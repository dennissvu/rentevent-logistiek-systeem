import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Wand2, Loader2, Check, ArrowDown, ArrowUp, AlertTriangle, Package, RotateCcw } from 'lucide-react';
import { useTransport } from '@/context/TransportContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  calculateTransportSuggestions,
  applyTransportAssignments,
  TransportSuggestion,
} from '@/utils/autoAssignTransport';
import { TransportMaterial, CombiTransport } from '@/data/transportData';
import { formatVehicleType } from '@/utils/capacityCalculator';

interface AutoAssignTransportButtonProps {
  date: string;
}

export function AutoAssignTransportButton({ date }: AutoAssignTransportButtonProps) {
  const { allTransportMaterials, combis } = useTransport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCalculating, setIsCalculating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TransportSuggestion[]>([]);
  const [selectedTransport, setSelectedTransport] = useState<Map<string, string>>(new Map());

  const allTransport = [...allTransportMaterials, ...combis];

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const result = await calculateTransportSuggestions(date, allTransport);

      if (result.length === 0) {
        toast({ title: 'Alle orders hebben al transport!' });
        return;
      }

      setSuggestions(result);

      const initial = new Map<string, string>();
      result.forEach(s => {
        if (s.suggestedTransportId) {
          initial.set(s.orderId, s.suggestedTransportId);
        }
      });
      setSelectedTransport(initial);
      setIsDialogOpen(true);
    } catch (err) {
      console.error('Auto-assign transport error:', err);
      toast({ title: 'Fout bij berekenen transport-suggesties', variant: 'destructive' });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const assignments = suggestions
        .filter(s => selectedTransport.has(s.orderId) && selectedTransport.get(s.orderId))
        .map(s => ({
          orderId: s.orderId,
          transportId: selectedTransport.get(s.orderId)!,
          segments: s.segments,
        }));

      if (assignments.length === 0) {
        toast({ title: 'Geen toewijzingen geselecteerd' });
        return;
      }

      await applyTransportAssignments(assignments);

      queryClient.invalidateQueries({ queryKey: ['daily-transport'] });
      queryClient.invalidateQueries({ queryKey: ['daily-planning'] });
      queryClient.invalidateQueries({ queryKey: ['order-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-order-assignments'] });

      toast({ title: `${assignments.length} transport-toewijzing${assignments.length !== 1 ? 'en' : ''} bevestigd!` });
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Apply transport error:', err);
      toast({ title: 'Fout bij toewijzen', variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  };

  const updateSelection = (orderId: string, transportId: string) => {
    setSelectedTransport(prev => {
      const next = new Map(prev);
      if (transportId === 'none') {
        next.delete(orderId);
      } else {
        next.set(orderId, transportId);
      }
      return next;
    });
  };

  const assignedCount = selectedTransport.size;
  const totalSlots = suggestions.length;

  // Separate bakwagens and combis for the select
  const bakwagens = allTransport.filter(t => 'type' in t && t.type === 'bakwagen');
  const combiOptions = allTransport.filter(t => 'bakwagenId' in t);

  return (
    <>
      <Button
        onClick={handleCalculate}
        disabled={isCalculating}
        variant="default"
        className="gap-2"
      >
        {isCalculating ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Wand2 className="h-4 w-4" />
        )}
        Transport toewijzen
      </Button>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Transport-suggesties
            </DialogTitle>
            <DialogDescription>
              {totalSlots} order{totalSlots !== 1 ? 's' : ''} zonder transport gevonden.
              Kiest het kleinste passende transport of hergebruikt wat al rijdt vandaag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            {suggestions.map((suggestion) => {
              const currentTransportId = selectedTransport.get(suggestion.orderId) || '';
              const loadDescription = suggestion.vehicleLoad
                .map(v => `${v.quantity}× ${formatVehicleType(v.type)}`)
                .join(', ');

              return (
                <div key={suggestion.orderId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {suggestion.segments.map(seg => (
                      seg === 'leveren' ? (
                        <Badge key={seg} className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1">
                          <ArrowDown className="h-3 w-3" />
                          Leveren
                        </Badge>
                      ) : (
                        <Badge key={seg} className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 gap-1">
                          <ArrowUp className="h-3 w-3" />
                          Ophalen
                        </Badge>
                      )
                    ))}
                    <span className="text-sm font-medium">{suggestion.orderNumber}</span>
                    <span className="text-sm text-muted-foreground">{suggestion.customerName}</span>
                  </div>

                  <div className="text-xs text-muted-foreground">
                    Lading: {loadDescription}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={currentTransportId || 'none'}
                      onValueChange={(v) => updateSelection(suggestion.orderId, v)}
                    >
                      <SelectTrigger className="w-[240px] h-8 text-sm">
                        <SelectValue placeholder="Kies transport" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">— Geen —</span>
                        </SelectItem>
                        {bakwagens.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Bakwagens</div>
                            {bakwagens.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </>
                        )}
                        {combiOptions.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">Combi's</div>
                            {combiOptions.map(t => (
                              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>

                    {suggestion.isReuse && currentTransportId === suggestion.suggestedTransportId && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <RotateCcw className="h-2.5 w-2.5" />
                        Hergebruik
                      </Badge>
                    )}

                    {!suggestion.isReuse && suggestion.suggestedTransportId && currentTransportId === suggestion.suggestedTransportId && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Check className="h-2.5 w-2.5" />
                        Aanbevolen
                      </Badge>
                    )}

                    {!suggestion.suggestedTransportId && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        Geen passend transport
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {assignedCount} van {totalSlots} geselecteerd
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuleren
              </Button>
              <Button
                onClick={handleApply}
                disabled={assignedCount === 0 || isApplying}
                className="gap-2"
              >
                {isApplying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}
                {assignedCount} toewijzing{assignedCount !== 1 ? 'en' : ''} bevestigen
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
