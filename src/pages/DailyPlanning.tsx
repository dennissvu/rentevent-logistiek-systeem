import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, addDays, subDays } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlanningChatPanel } from '@/components/planning/PlanningChatPanel';
import { CalendarDays, Printer, ChevronLeft, ChevronRight, FileText, Loader2, Users, ClipboardList, Package } from 'lucide-react';
import { useDailyPlanningData } from '@/hooks/useDailyPlanningData';
import { OrderBlock } from '@/components/planning/DailyOrderBlock';
import { useDriverDayOverview } from '@/hooks/useDriverDayOverview';
import { useDailyTransportData } from '@/hooks/useDailyTransportData';
import { DriverDayGrid } from '@/components/planning/DriverDayGrid';
import { TransportDayGrid } from '@/components/planning/TransportDayGrid';
import { AutoAssignButton } from '@/components/planning/AutoAssignButton';
import { AutoAssignTransportButton } from '@/components/planning/AutoAssignTransportButton';
import { SmartPlanButton } from '@/components/planning/SmartPlanButton';
import { fetchAndPrintTrips } from '@/utils/batchTripPrint';
import { useToast } from '@/hooks/use-toast';

export default function DailyPlanning() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [printingAll, setPrintingAll] = useState(false);
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const { data: orders = [], isLoading } = useDailyPlanningData(dateStr);
  const { data: driverOverview = [], isLoading: driversLoading } = useDriverDayOverview(dateStr);
  const { data: transportOrders = [], isLoading: transportLoading } = useDailyTransportData(dateStr);
  const ordersWithoutTransport = transportOrders.filter(o => !o.hasTransport).length;

  const handlePrint = () => window.print();

  const handlePrintAllTrips = async () => {
    setPrintingAll(true);
    try {
      await fetchAndPrintTrips(dateStr);
    } catch (err) {
      console.error('Print error:', err);
      toast({ title: 'Fout bij genereren ritplanningen', variant: 'destructive' });
    } finally {
      setPrintingAll(false);
    }
  };

  const handlePrintOrderTrips = async (e: React.MouseEvent, orderId: string) => {
    e.stopPropagation();
    setPrintingOrderId(orderId);
    try {
      await fetchAndPrintTrips(dateStr, { orderId });
    } catch (err) {
      console.error('Print error:', err);
      toast({ title: 'Fout bij genereren ritplanning', variant: 'destructive' });
    } finally {
      setPrintingOrderId(null);
    }
  };

  return (
    <div className="daily-planning-page h-[calc(100vh-3.5rem)] flex print:block print:h-auto">
      {/* Left: main planning content */}
      <div className="flex-1 overflow-y-auto p-6 print:p-0 print:overflow-visible">
        {/* Screen-only controls */}
        <div className="flex flex-wrap items-center gap-3 mb-6 print:hidden">
          <h1 className="text-2xl font-bold">Dagplanning</h1>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <CalendarDays className="h-4 w-4" />
                  {format(selectedDate, 'EEEE d MMMM yyyy', { locale: nl })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={selectedDate} onSelect={(d) => d && setSelectedDate(d)} locale={nl} />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setSelectedDate(d => addDays(d, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <SmartPlanButton date={dateStr} />
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-1.5">
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <Button onClick={handlePrintAllTrips} disabled={printingAll || orders.length === 0} variant="outline" size="sm" className="gap-1.5">
              {printingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              Ritplanningen
            </Button>
          </div>
        </div>

        {/* Print header */}
        <div className="print-header hidden print:block">
          <h1>Dagplanning {format(selectedDate, 'd MMMM yyyy', { locale: nl })}</h1>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="orders" className="print:hidden">
          <TabsList className="mb-4">
            <TabsTrigger value="orders" className="gap-1.5">
              <ClipboardList className="h-4 w-4" />
              Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="transport" className="gap-1.5">
              <Package className="h-4 w-4" />
              Transport
              {ordersWithoutTransport > 0 && (
                <span className="ml-1 inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400 text-[10px] font-semibold">
                  {ordersWithoutTransport}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="chauffeurs" className="gap-1.5">
              <Users className="h-4 w-4" />
              Chauffeurs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">Laden...</div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Geen orders op {format(selectedDate, 'd MMMM yyyy', { locale: nl })}
              </div>
            ) : (
              <div className="orders-list">
                {orders.map((order) => (
                  <OrderBlock
                    key={order.orderId}
                    order={order}
                    date={dateStr}
                    onClick={() => navigate(`/orders/${order.orderId}`)}
                    onPrintTrips={(e) => handlePrintOrderTrips(e, order.orderId)}
                    isPrinting={printingOrderId === order.orderId}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="transport">
            <div className="flex justify-end mb-4">
              <AutoAssignTransportButton date={dateStr} />
            </div>
            <TransportDayGrid orders={transportOrders} isLoading={transportLoading} />
          </TabsContent>

          <TabsContent value="chauffeurs">
            <div className="flex justify-end mb-4">
              <AutoAssignButton date={dateStr} />
            </div>
            <DriverDayGrid drivers={driverOverview} isLoading={driversLoading} />
          </TabsContent>
        </Tabs>

        {/* Print-only */}
        <div className="hidden print:block">
          <div className="orders-list">
            {orders.map((order) => (
              <OrderBlock key={order.orderId} order={order} date={dateStr} onClick={() => {}} onPrintTrips={() => {}} isPrinting={false} />
            ))}
          </div>
        </div>
      </div>

      {/* Right: always-visible chat panel */}
      <div className="w-[380px] shrink-0 print:hidden">
        <PlanningChatPanel date={dateStr} />
      </div>

      {/* Print styles */}
      <style>{`
        .print-header h1 {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 2px solid #1a1a2e;
        }

        .orders-list {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .order-block { padding: 14px 0; border-bottom: 2px solid hsl(var(--border)); }
        .order-header { display: flex; gap: 12px; align-items: baseline; margin-bottom: 8px; }
        .order-print-btn { margin-left: auto; background: none; border: 1px solid hsl(var(--border)); border-radius: 4px; padding: 4px 6px; cursor: pointer; color: hsl(var(--muted-foreground)); display: flex; align-items: center; transition: all 0.15s; }
        .order-print-btn:hover:not(:disabled) { background: hsl(var(--accent)); color: hsl(var(--accent-foreground)); }
        .order-print-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .order-number { font-weight: 700; font-size: 14px; color: hsl(var(--primary)); }
        .customer-name { font-weight: 600; font-size: 14px; }
        .vehicle-summary { font-size: 13px; color: hsl(var(--muted-foreground)); }
        .segment-row { display: grid; grid-template-columns: 100px 90px 1fr auto; align-items: baseline; padding: 2px 0; font-size: 13px; }
        .inline-assign-editor { display: flex; gap: 12px; padding: 6px 0 6px 100px; }
        .inline-assign-field { display: flex; align-items: center; gap: 6px; flex: 1; }
        .inline-assign-label { font-size: 11px; font-weight: 600; color: hsl(var(--muted-foreground)); white-space: nowrap; }
        .segment-row.sub { padding: 0; }
        .segment-label { font-weight: 600; font-size: 13px; }
        .segment-label.leveren { color: #059669; }
        .segment-label.ophalen { color: #dc2626; }
        .segment-time { font-weight: 600; font-size: 13px; }
        .segment-drivers { font-weight: 600; font-size: 13px; }
        .segment-transport { font-size: 12px; color: hsl(var(--muted-foreground)); }
        .location-text { font-size: 12px; color: hsl(var(--muted-foreground)); grid-column: 2 / -1; }
        .segment-spacer { height: 6px; }
        .load-plan { margin-top: 10px; padding-top: 6px; border-top: 1px dashed hsl(var(--border)); }
        .load-row { display: grid; grid-template-columns: 140px 120px 1fr; padding: 2px 0; font-size: 12px; }
        .load-row.stay-loaded { color: #2563eb; font-weight: 500; }
        .load-location { font-weight: 500; }
        .load-transport { color: hsl(var(--muted-foreground)); }
        .load-vehicles { font-weight: 500; }
        .order-notes { margin-top: 8px; padding: 6px 10px; background: #fef3c7; border: 1px solid #f59e0b; border-radius: 4px; font-size: 12px; font-weight: 500; color: #78350f; }

        @media print {
          @page { margin: 10mm 12mm; size: A4 portrait; }
          body { font-size: 9px !important; }
          .daily-planning-page { padding: 0 !important; display: block !important; height: auto !important; }
          .order-print-btn { display: none !important; }
          .print-header { display: block !important; }
          .print-header h1 { font-size: 14px; margin-bottom: 8px; padding-bottom: 4px; }
          .orders-list { display: grid !important; grid-template-columns: 1fr 1fr; gap: 0 20px; }
          .order-block { break-inside: avoid; border-bottom-color: #333; padding: 8px 0; }
          .order-header { margin-bottom: 4px; gap: 6px; }
          .order-number { color: #000 !important; font-size: 11px; }
          .customer-name { font-size: 11px; }
          .vehicle-summary { font-size: 10px; color: #555 !important; }
          .segment-row { grid-template-columns: 70px 70px 1fr; font-size: 10px; padding: 1px 0; }
          .inline-assign-editor { display: none !important; }
          .segment-label { font-size: 10px; }
          .segment-label.leveren { color: #059669 !important; }
          .segment-label.ophalen { color: #dc2626 !important; }
          .segment-time { font-size: 10px; }
          .segment-drivers { font-size: 10px; }
          .segment-transport, .location-text { font-size: 9px; color: #555 !important; }
          .segment-spacer { height: 3px; }
          .load-plan { margin-top: 6px; padding-top: 4px; }
          .load-row { grid-template-columns: 100px 80px 1fr; font-size: 9px; padding: 1px 0; }
          .load-transport { color: #555 !important; }
          .order-notes { margin-top: 4px; padding: 4px 6px; font-size: 9px; background: #fef3c7 !important; border-color: #f59e0b !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .load-row.stay-loaded { color: #2563eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
