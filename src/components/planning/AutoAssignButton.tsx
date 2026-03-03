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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Wand2, Loader2, Check, ArrowDown, ArrowUp, AlertTriangle, Truck, RefreshCw } from 'lucide-react';
import { useTransport } from '@/context/TransportContext';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  calculateAutoAssignments,
  applyDriverAssignments,
  DriverSuggestion,
  AvailableDriver,
  OrderWithoutTransport,
} from '@/utils/autoAssignDrivers';

interface AutoAssignButtonProps {
  date: string;
}

export function AutoAssignButton({ date }: AutoAssignButtonProps) {
  const { allTransportMaterials, combis } = useTransport();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [isCalculating, setIsCalculating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reassignAll, setReassignAll] = useState(false);
  const [suggestions, setSuggestions] = useState<DriverSuggestion[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [ordersWithoutTransport, setOrdersWithoutTransport] = useState<OrderWithoutTransport[]>([]);
  const [selectedDrivers, setSelectedDrivers] = useState<Map<string, string>>(new Map());

  const handleCalculate = async () => {
    setIsCalculating(true);
    try {
      const allTransport = [...allTransportMaterials, ...combis];
      const transportNames = new Map(allTransport.map(t => [t.id, t.name]));

      const result = await calculateAutoAssignments(date, transportNames, reassignAll);

      if (result.suggestions.length === 0 && result.ordersWithoutTransport.length === 0) {
        toast({ title: 'Alle ritten hebben al een chauffeur!' });
        return;
      }

      setSuggestions(result.suggestions);
      setAvailableDrivers(result.availableDrivers);
      setOrdersWithoutTransport(result.ordersWithoutTransport);

      const initial = new Map<string, string>();
      result.suggestions.forEach(s => {
        if (s.suggestedDriverId) {
          initial.set(s.slot.assignmentId, s.suggestedDriverId);
        }
      });
      setSelectedDrivers(initial);
      setIsDialogOpen(true);
    } catch (err) {
      console.error('Auto-assign error:', err);
      toast({ title: 'Fout bij berekenen suggesties', variant: 'destructive' });
    } finally {
      setIsCalculating(false);
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      const assignments = Array.from(selectedDrivers.entries())
        .filter(([_, driverId]) => driverId)
        .map(([assignmentId, driverId]) => ({ assignmentId, driverId }));

      if (assignments.length === 0) {
        toast({ title: 'Geen toewijzingen geselecteerd' });
        return;
      }

      await applyDriverAssignments(assignments);

      queryClient.invalidateQueries({ queryKey: ['driver-day-overview'] });
      queryClient.invalidateQueries({ queryKey: ['daily-planning'] });
      queryClient.invalidateQueries({ queryKey: ['order-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['all-order-assignments'] });

      toast({ title: `${assignments.length} chauffeur${assignments.length !== 1 ? 's' : ''} toegewezen!` });
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Apply error:', err);
      toast({ title: 'Fout bij toewijzen', variant: 'destructive' });
    } finally {
      setIsApplying(false);
    }
  };

  const updateSelection = (assignmentId: string, driverId: string) => {
    setSelectedDrivers(prev => {
      const next = new Map(prev);
      if (driverId === 'none') {
        next.delete(assignmentId);
      } else {
        next.set(assignmentId, driverId);
      }
      return next;
    });
  };

  const assignedCount = selectedDrivers.size;
  const totalSlots = suggestions.length;

  return (
    <>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <Switch
            id="reassign-mode"
            checked={reassignAll}
            onCheckedChange={setReassignAll}
          />
          <Label htmlFor="reassign-mode" className="text-sm cursor-pointer">
            Opnieuw indelen
          </Label>
        </div>
        <Button
          onClick={handleCalculate}
          disabled={isCalculating}
          variant={reassignAll ? 'default' : 'default'}
          className="gap-2"
        >
          {isCalculating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : reassignAll ? (
            <RefreshCw className="h-4 w-4" />
          ) : (
            <Wand2 className="h-4 w-4" />
          )}
          {reassignAll ? 'Chauffeurs herinplannen' : 'Chauffeurs toewijzen'}
        </Button>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5" />
              Chauffeur-suggesties
            </DialogTitle>
             <DialogDescription>
              {reassignAll
                ? `Alle ${totalSlots} slot${totalSlots !== 1 ? 's' : ''} worden opnieuw ingedeeld voor optimale verdeling.`
                : totalSlots > 0
                  ? `${totalSlots} open slot${totalSlots !== 1 ? 's' : ''} gevonden. Pas suggesties aan of bevestig direct.`
                  : 'Geen open slots gevonden.'}
            </DialogDescription>
          </DialogHeader>

          {/* Warning: orders without transport */}
          {ordersWithoutTransport.length > 0 && (
            <div className="border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 rounded-lg p-3 space-y-1">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-medium text-sm">
                <AlertTriangle className="h-4 w-4" />
                {ordersWithoutTransport.length} order{ordersWithoutTransport.length !== 1 ? 's' : ''} zonder transport
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Wijs eerst transport toe via het Transport-tab voordat chauffeurs kunnen worden toegewezen.
              </p>
              <ul className="text-xs space-y-0.5 text-amber-700 dark:text-amber-400">
                {ordersWithoutTransport.map(o => (
                  <li key={o.orderId}>
                    <span className="font-semibold">{o.orderNumber}</span> — {o.customerName}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-3 py-2">
            {suggestions.map((suggestion) => {
              const { slot } = suggestion;
              const currentDriverId = selectedDrivers.get(slot.assignmentId) || '';

              return (
                <div key={slot.assignmentId} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    {slot.segment === 'leveren' ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300 gap-1">
                        <ArrowDown className="h-3 w-3" />
                        Leveren
                      </Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300 gap-1">
                        <ArrowUp className="h-3 w-3" />
                        Ophalen
                      </Badge>
                    )}
                    <span className="font-semibold text-sm">{slot.time}</span>
                    <span className="text-sm">·</span>
                    <span className="text-sm font-medium">{slot.orderNumber}</span>
                    <span className="text-sm text-muted-foreground">{slot.customerName}</span>
                    {slot.requiresTrailer && (
                      <Badge variant="outline" className="text-[10px] gap-0.5 px-1.5">
                        <Truck className="h-2.5 w-2.5" />
                        AH
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground">
                    {slot.transportName}
                    {slot.currentDriverId && reassignAll && (
                      <span className="ml-2 text-amber-600">
                        (was: {availableDrivers.find(d => d.id === slot.currentDriverId)?.name || 'onbekend'})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select
                      value={currentDriverId || 'none'}
                      onValueChange={(v) => updateSelection(slot.assignmentId, v)}
                    >
                      <SelectTrigger className="w-[200px] h-8 text-sm">
                        <SelectValue placeholder="Kies chauffeur" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">
                          <span className="text-muted-foreground">— Geen —</span>
                        </SelectItem>
                        {availableDrivers
                          .filter(d => !slot.requiresTrailer || d.canDriveTrailer)
                          .map(driver => (
                            <SelectItem key={driver.id} value={driver.id}>
                              {driver.name}
                              {driver.canDriveTrailer && ' (AH)'}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {suggestion.suggestedDriverId && currentDriverId === suggestion.suggestedDriverId && (
                      <Badge variant="secondary" className="text-[10px] gap-1">
                        <Check className="h-2.5 w-2.5" />
                        Aanbevolen
                      </Badge>
                    )}

                    {!suggestion.suggestedDriverId && (
                      <div className="flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" />
                        {suggestion.reason}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {assignedCount} van {totalSlots} slots toegewezen
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
