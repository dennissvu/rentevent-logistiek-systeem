import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { 
  ArrowLeft, 
  CalendarIcon, 
  CalendarPlus,
  Save, 
  Trash2, 
  Mail, 
  Phone, 
  Building2,
  MapPin,
  Clock,
  Users,
  Timer,
  Bike,
  Copy,
  Truck,
  User,
  Pencil,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useOrders } from '@/context/OrdersContext';
import { getStatusColor, getStatusLabel, orderStatuses } from '@/data/ordersData';
import { useToast } from '@/hooks/use-toast';
import { DriverScheduleCard, TripPrintContext } from '@/components/planning/DriverScheduleCard';
import { WaitTimeCard } from '@/components/planning/WaitTimeCard';
import { CombinedUnloadingCard } from '@/components/planning/CombinedUnloadingCard';
import { vehicleTypes, VehicleType, bakwagens, aanhangers, combis } from '@/data/transportData';
import { MultiTransportAssignment } from '@/components/orders/MultiTransportAssignment';
import { RouteSuggestionBanner } from '@/components/orders/RouteSuggestionBanner';
import { LoadUnloadPlan } from '@/components/orders/LoadUnloadPlan';
import { VehicleSelector, VehicleSelection } from '@/components/orders/VehicleSelector';
import { NotesCard } from '@/components/orders/NotesCard';
import { VehicleCount } from '@/utils/capacityChecker';
import { LogisticDatesCard } from '@/components/orders/LogisticDatesCard';
import { RentalAgreementCard } from '@/components/orders/RentalAgreementCard';
import { useOrderAssignments } from '@/hooks/useOrderAssignments';
import { useDriversDb } from '@/hooks/useDriversDb';
import { useLoadUnloadInstructions } from '@/hooks/useLoadUnloadInstructions';
import { TIME_CONSTANTS, calculateCombinedUnloadTime, needsTrailer as checkNeedsTrailer } from '@/utils/driverScheduleCalculator';
import { calculateDriverShopTime } from '@/utils/shopTimeCalculator';
import { downloadIcsFile } from '@/utils/icsGenerator';

const orderFormSchema = z.object({
  firstName: z.string().min(1, 'Voornaam is verplicht'),
  lastName: z.string().min(1, 'Achternaam is verplicht'),
  email: z.string().email('Ongeldig e-mailadres'),
  phone: z.string().min(1, 'Telefoonnummer is verplicht'),
  companyName: z.string().optional(),
  numberOfPersons: z.coerce.number().min(12, 'Minimaal 12 personen'),
  startDate: z.date({ required_error: 'Startdatum is verplicht' }),
  endDate: z.date({ required_error: 'Einddatum is verplicht' }),
  startTime: z.string().min(1, 'Starttijd is verplicht'),
  endTime: z.string().min(1, 'Eindtijd is verplicht'),
  startLocation: z.string().min(1, 'Startlocatie is verplicht'),
  endLocation: z.string().min(1, 'Eindlocatie is verplicht'),
  notes: z.string().optional(),
  status: z.enum(['offerte', 'optie', 'bevestigd']),
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { orders, isLoading, updateOrder, deleteOrder } = useOrders();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editVehicleTypes, setEditVehicleTypes] = useState<VehicleSelection[]>([]);
  const [showTransportEdit, setShowTransportEdit] = useState(false);
  const [planConfirmedManually, setPlanConfirmedManually] = useState(false);
  
  // Haal multi-transport assignments op
  const { leverenAssignments, ophalenAssignments, copyToOphalen, isCopying } = useOrderAssignments(id || '');
  
  // Haal chauffeurs op voor naam weergave
  const { drivers } = useDriversDb();
  
  // Haal laad-/losinstructies op
  const { instructions: loadUnloadInstructions } = useLoadUnloadInstructions(id || '');
  
  // Plan is confirmed if manually clicked OR if instructions already exist in DB
  const planConfirmed = planConfirmedManually || loadUnloadInstructions.length > 0;
  const setPlanConfirmed = setPlanConfirmedManually;

  const order = orders.find((o) => o.id === id);

  // Build print context for trip documents
  const allTransport = [...bakwagens, ...aanhangers, ...combis];
  const printContext: TripPrintContext | undefined = useMemo(() => {
    if (!order) return undefined;
    const vtSummary = (order.vehicleTypes || [])
      .map(vt => {
        const info = vehicleTypes.find(v => v.id === vt.type);
        return `${vt.count}x ${info?.name || vt.type}`;
      })
      .join(', ');

    // Build load steps from instructions
    const loadSteps = loadUnloadInstructions.map(inst => {
      const isLeveren = leverenAssignments.some(a => a.id === inst.assignmentId);
      const assignment = [...leverenAssignments, ...ophalenAssignments].find(a => a.id === inst.assignmentId);
      const vtInfo = vehicleTypes.find(v => v.id === inst.vehicleType);
      const helperNames = (inst.helperDriverIds || [])
        .map((hid: string) => drivers.find(d => d.id === hid)?.name)
        .filter(Boolean) as string[];

      // Resolve specific sub-transport (bakwagen/aanhanger) name instead of combi name
      let transportName = '';
      if (inst.targetTransportId) {
        const subTransport = allTransport.find(t => t.id === inst.targetTransportId);
        transportName = subTransport?.name || '';
      } else if (assignment) {
        const transport = allTransport.find(t => t.id === assignment.transportId);
        transportName = transport?.name || '';
      }

      return {
        action: inst.action as 'laden' | 'lossen',
        location: inst.location === 'winkel' ? 'Winkel' : inst.location === 'loods' ? 'Loods' : 'Blijft staan',
        vehicleType: vtInfo?.name || inst.vehicleType,
        vehicleIcon: vtInfo?.icon || '🚲',
        vehicleCount: inst.vehicleCount,
        stayLoadedCount: inst.location === 'blijft_staan' ? inst.vehicleCount : 0,
        helperNames,
        transportName,
      };
    });

    return {
      orderNumber: order.orderNumber,
      customerName: `${order.firstName} ${order.lastName}`,
      customerPhone: order.phone,
      customerEmail: order.email,
      companyName: order.companyName || undefined,
      bookingDate: format(parseISO(order.startDate), 'EEEE d MMMM yyyy', { locale: nl }),
      customerEndTime: order.endTime,
      numberOfPersons: order.numberOfPersons,
      vehiclesSummary: vtSummary || `${order.numberOfPersons} voertuigen`,
      deliveryLocation: order.startLocation,
      pickupLocation: order.endLocation,
      loadSteps,
      notes: order.notes || undefined,
    };
  }, [order, loadUnloadInstructions, leverenAssignments, ophalenAssignments, drivers, allTransport]);
  
  // Bereken gecombineerde laad/lostijden voor leveren en ophalen
  const vehicleCount = order?.vehicleTypes?.reduce((sum, v) => sum + v.count, 0) || order?.numberOfPersons || 0;
  
  const combinedLeverenResult = leverenAssignments.length >= 2 ? (() => {
    const [a1, a2] = leverenAssignments;
    const driver1HasTrailer = checkNeedsTrailer(a1.transportId);
    const driver2HasTrailer = checkNeedsTrailer(a2.transportId);
    const driver1VehicleCount = Math.ceil(vehicleCount / 2);
    const driver2VehicleCount = Math.floor(vehicleCount / 2);
    return calculateCombinedUnloadTime({
      segment: 'leveren',
      driver1VehicleCount,
      driver1HasTrailer,
      driver2VehicleCount,
      driver2HasTrailer,
    });
  })() : null;

  const combinedOphalenResult = ophalenAssignments.length >= 2 ? (() => {
    const [a1, a2] = ophalenAssignments;
    const driver1HasTrailer = checkNeedsTrailer(a1.transportId);
    const driver2HasTrailer = checkNeedsTrailer(a2.transportId);
    const driver1VehicleCount = Math.ceil(vehicleCount / 2);
    const driver2VehicleCount = Math.floor(vehicleCount / 2);
    return calculateCombinedUnloadTime({
      segment: 'ophalen',
      driver1VehicleCount,
      driver1HasTrailer,
      driver2VehicleCount,
      driver2HasTrailer,
    });
  })() : null;

  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: order
      ? {
          firstName: order.firstName,
          lastName: order.lastName,
          email: order.email,
          phone: order.phone,
          companyName: order.companyName || '',
          numberOfPersons: order.numberOfPersons,
          startDate: parseISO(order.startDate),
          endDate: parseISO(order.endDate),
          startTime: order.startTime,
          endTime: order.endTime,
          startLocation: order.startLocation,
          endLocation: order.endLocation,
          notes: order.notes || '',
          status: order.status,
        }
      : {
          firstName: '',
          lastName: '',
          email: '',
          phone: '',
          companyName: '',
          numberOfPersons: 12,
          startDate: new Date(),
          endDate: new Date(),
          startTime: '09:00',
          endTime: '17:00',
          startLocation: '',
          endLocation: '',
          notes: '',
          status: 'offerte' as const,
        },
  });

  useEffect(() => {
    if (order) {
      form.reset({
        firstName: order.firstName,
        lastName: order.lastName,
        email: order.email,
        phone: order.phone,
        companyName: order.companyName || '',
        numberOfPersons: order.numberOfPersons,
        startDate: parseISO(order.startDate),
        endDate: parseISO(order.endDate),
        startTime: order.startTime,
        endTime: order.endTime,
        startLocation: order.startLocation,
        endLocation: order.endLocation,
        notes: order.notes || '',
        status: order.status,
      });
      setEditVehicleTypes(order.vehicleTypes || []);
    }
  }, [order, form]);
  
  // Loading state - AFTER all hooks
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Order laden...</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <p className="text-muted-foreground">Order niet gevonden</p>
        <Button onClick={() => navigate('/orders')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Terug naar orders
        </Button>
      </div>
    );
  }

  const handleSubmit = (values: OrderFormValues) => {
    updateOrder(order.id, {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      companyName: values.companyName,
      numberOfPersons: values.numberOfPersons,
      startDate: format(values.startDate, 'yyyy-MM-dd'),
      endDate: format(values.endDate, 'yyyy-MM-dd'),
      startTime: values.startTime,
      endTime: values.endTime,
      startLocation: values.startLocation,
      endLocation: values.endLocation,
      notes: values.notes,
      status: values.status,
      vehicleTypes: editVehicleTypes,
    });
    setIsEditing(false);
    toast({
      title: 'Order bijgewerkt',
      description: 'De wijzigingen zijn opgeslagen.',
    });
  };

  const handleDelete = () => {
    deleteOrder(order.id);
    toast({
      title: 'Order verwijderd',
      description: 'De order is succesvol verwijderd.',
    });
    navigate('/orders');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{order.orderNumber}</h1>
              <Badge className={getStatusColor(order.status)}>
                {getStatusLabel(order.status)}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Aangemaakt op {format(parseISO(order.createdAt), 'dd MMMM yyyy', { locale: nl })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isEditing ? (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Agenda
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-2" align="end">
                  <div className="space-y-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => downloadIcsFile({
                        orderNumber: order.orderNumber,
                        customerName: `${order.firstName} ${order.lastName}`,
                        companyName: order.companyName || undefined,
                        location: order.startLocation,
                        startDate: order.deliveryDate || order.startDate,
                        startTime: order.deliveryTime || order.startTime,
                        endDate: order.endDate,
                        endTime: order.endTime,
                        segment: 'leveren',
                        notes: order.notes || undefined,
                      })}
                    >
                      🚚 Leveren downloaden
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start"
                      onClick={() => downloadIcsFile({
                        orderNumber: order.orderNumber,
                        customerName: `${order.firstName} ${order.lastName}`,
                        companyName: order.companyName || undefined,
                        location: order.endLocation,
                        startDate: order.startDate,
                        startTime: order.startTime,
                        endDate: order.pickupDate || order.endDate,
                        endTime: order.pickupTime || order.endTime,
                        segment: 'ophalen',
                        notes: order.notes || undefined,
                      })}
                    >
                      📦 Ophalen downloaden
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={() => setIsEditing(true)}>Bewerken</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Order verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Weet je zeker dat je order {order.orderNumber} wilt verwijderen? 
                      Deze actie kan niet ongedaan worden gemaakt.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                Annuleren
              </Button>
              <Button onClick={form.handleSubmit(handleSubmit)}>
                <Save className="mr-2 h-4 w-4" />
                Opslaan
              </Button>
            </>
          )}
        </div>
      </div>

      {isEditing ? (
        /* Edit Form */
        <Form {...form}>
          <form className="space-y-6">
            {/* Klantgegevens */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Klantgegevens</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Voornaam *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Achternaam *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mailadres *</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefoonnummer *</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="companyName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bedrijfsnaam</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Boeking details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Boeking details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="numberOfPersons"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Aantal personen *</FormLabel>
                        <FormControl>
                          <Input type="number" min={12} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {orderStatuses.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Startdatum *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP', { locale: nl })
                                ) : (
                                  <span>Kies een datum</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Einddatum *</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  'w-full pl-3 text-left font-normal',
                                  !field.value && 'text-muted-foreground'
                                )}
                              >
                                {field.value ? (
                                  format(field.value, 'PPP', { locale: nl })
                                ) : (
                                  <span>Kies een datum</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              initialFocus
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Starttijd *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Eindtijd *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="startLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Afleverlocatie *</FormLabel>
                      <FormControl>
                        <Input placeholder="Waar worden de voertuigen afgeleverd?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ophaallocatie *</FormLabel>
                      <FormControl>
                        <Input placeholder="Waar worden de voertuigen opgehaald?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                </div>
              </CardContent>
            </Card>

            {/* Notities */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Notities</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Bericht/opmerking/vraag"
                          className="min-h-[100px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Voertuigen bewerken */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bike className="h-5 w-5" />
                  Voertuigen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <VehicleSelector 
                  value={editVehicleTypes} 
                  onChange={setEditVehicleTypes} 
                />
              </CardContent>
            </Card>
          </form>
        </Form>
      ) : (
        /* View Mode */
        <div className="grid gap-6 md:grid-cols-2">
          {/* Klantgegevens */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Klantgegevens</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Naam</p>
                <p className="font-medium">{order.firstName} {order.lastName}</p>
              </div>
              {order.companyName && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span>{order.companyName}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <a href={`mailto:${order.email}`} className="text-primary hover:underline">
                  {order.email}
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <a href={`tel:${order.phone}`} className="text-primary hover:underline">
                  {order.phone}
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Boeking details + Voertuigen */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Boeking details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.numberOfPersons} personen</span>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Datum</p>
                <p className="font-medium">
                  {format(parseISO(order.startDate), 'EEEE dd MMMM yyyy', { locale: nl })}
                  {order.startDate !== order.endDate && (
                    <> t/m {format(parseISO(order.endDate), 'EEEE dd MMMM yyyy', { locale: nl })}</>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span>{order.startTime} - {order.endTime}</span>
              </div>

              {/* Voertuigen inline */}
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Bike className="h-4 w-4" />
                  Voertuigen
                </p>
                {order.vehicleTypes && order.vehicleTypes.length > 0 ? (
                  <div className="space-y-1.5">
                    {order.vehicleTypes.map((vt, index) => {
                      const vehicleInfo = vehicleTypes.find(v => v.id === vt.type);
                      return (
                        <div key={index} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{vehicleInfo?.icon || '🚲'}</span>
                            <span className="font-medium text-sm">{vehicleInfo?.name || vt.type}</span>
                          </div>
                          <span className="font-bold">{vt.count}x</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between text-sm pt-1">
                      <span className="text-muted-foreground">Totaal</span>
                      <span className="font-bold">
                        {order.vehicleTypes.reduce((sum, vt) => sum + vt.count, 0)} voertuigen
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground italic text-sm">Geen voertuigen geselecteerd</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Locaties */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Locaties</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Afleverlocatie</p>
                  <p className="font-medium">{order.startLocation}</p>
                  <p className="text-xs text-muted-foreground">Leveren om {order.startTime}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-blue-600 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Ophaallocatie</p>
                  <p className="font-medium">{order.endLocation}</p>
                  <p className="text-xs text-muted-foreground">Ophalen om {order.endTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notities */}
          <NotesCard
            notes={order.notes}
            onSave={(newNotes) => {
              updateOrder(order.id, { notes: newNotes || undefined });
              toast({ title: 'Notities bijgewerkt' });
            }}
          />

          {/* Logistieke planning - spanning full width */}
          <div className="md:col-span-2">
            <LogisticDatesCard
              startDate={order.startDate}
              endDate={order.endDate}
              startTime={order.startTime}
              endTime={order.endTime}
              deliveryDate={order.deliveryDate}
              deliveryTime={order.deliveryTime}
              pickupDate={order.pickupDate}
              pickupTime={order.pickupTime}
              deliveryWindowStart={order.deliveryWindowStart}
              deliveryWindowEnd={order.deliveryWindowEnd}
              pickupWindowStart={order.pickupWindowStart}
              pickupWindowEnd={order.pickupWindowEnd}
              onUpdate={(updates) => {
                updateOrder(order.id, updates);
                toast({ title: 'Logistieke planning bijgewerkt' });
              }}
            />
          </div>

          {/* Verhuurovereenkomst */}
          <div className="md:col-span-2">
            <RentalAgreementCard orderId={order.id} />
          </div>
        </div>
      )}

      {/* Route suggesties - toon wanneer er andere chauffeurs op dezelfde dag rijden */}
      {!isEditing && order.status === 'bevestigd' && (
        <div className="mt-4">
          <RouteSuggestionBanner
            orderStartDate={order.startDate}
            orderEndDate={order.endDate}
            excludeOrderId={order.id}
          />
        </div>
      )}

      {/* Transport & Chauffeur Samenvatting - alleen in view mode voor bevestigde orders */}
      {!isEditing && order.status === 'bevestigd' && (
        <div className="mt-6">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  Transport & Chauffeurs
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowTransportEdit(!showTransportEdit)}
                >
                  {showTransportEdit ? (
                    <>
                      <ChevronUp className="h-4 w-4 mr-1" />
                      Sluiten
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4 mr-1" />
                      Wijzigen
                    </>
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {/* Assignment summary */}
              {(leverenAssignments.length > 0 || ophalenAssignments.length > 0) ? (
                <div className="space-y-3">
                  {/* Leveren summary */}
                  {leverenAssignments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Leveren</p>
                      {leverenAssignments.map((assignment, index) => {
                        const driver = assignment.driverId
                          ? drivers.find(d => d.id === assignment.driverId)
                          : undefined;
                        const transport = bakwagens.find(b => b.id === assignment.transportId)
                          || combis.find(c => c.id === assignment.transportId);
                        return (
                          <div key={assignment.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{transport?.name || 'Niet toegewezen'}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{driver?.name || <span className="text-muted-foreground italic">Geen chauffeur</span>}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Ophalen summary */}
                  {ophalenAssignments.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ophalen</p>
                      {ophalenAssignments.map((assignment, index) => {
                        const driver = assignment.driverId
                          ? drivers.find(d => d.id === assignment.driverId)
                          : undefined;
                        const transport = bakwagens.find(b => b.id === assignment.transportId)
                          || combis.find(c => c.id === assignment.transportId);
                        return (
                          <div key={assignment.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate">{transport?.name || 'Niet toegewezen'}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              <User className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{driver?.name || <span className="text-muted-foreground italic">Geen chauffeur</span>}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-sm">Nog geen transport of chauffeur toegewezen</p>
              )}

              {/* Collapsible edit panel */}
              {showTransportEdit && (
                <div className="mt-4 pt-4 border-t">
                  <MultiTransportAssignment
                    orderId={order.id}
                    vehicles={(order.vehicleTypes || []).map(vt => ({
                      type: vt.type,
                      count: vt.count,
                    })) as VehicleCount[]}
                    startTime={order.startTime}
                    endTime={order.endTime}
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Laad- & Losplan - alleen in view mode voor bevestigde orders met assignments */}
      {!isEditing && order.status === 'bevestigd' && (leverenAssignments.length > 0 || ophalenAssignments.length > 0) && (
        <div className="mt-6">
          <LoadUnloadPlan
            orderId={order.id}
            leverenAssignments={leverenAssignments}
            ophalenAssignments={ophalenAssignments}
            orderVehicleTypes={(order.vehicleTypes || []) as { type: import('@/data/transportData').VehicleType; count: number }[]}
            onConfirm={() => setPlanConfirmed(true)}
          />
        </div>
      )}

      {/* Chauffeur Planning - alleen in view mode, toont planning per transport assignment */}
      {!isEditing && order.status === 'bevestigd' && leverenAssignments.length > 0 && (
        <div className="mt-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Ritplanning Leveren</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToOphalen()}
              disabled={isCopying}
            >
              <Copy className="h-4 w-4 mr-2" />
              {isCopying ? 'Kopiëren...' : 'Kopieer naar ophalen'}
            </Button>
          </div>

          {/* Gecombineerd uitladen optie - alleen bij 2+ chauffeurs */}
          {leverenAssignments.length >= 2 && (
            <CombinedUnloadingCard
              assignments={leverenAssignments.map(a => {
                const driver = a.driverId ? drivers.find(d => d.id === a.driverId) : undefined;
                const transport = bakwagens.find(b => b.id === a.transportId) 
                  || combis.find(c => c.id === a.transportId);
                return {
                  id: a.id,
                  transportId: a.transportId,
                  driverId: a.driverId,
                  driverName: driver?.name,
                  transportName: transport?.name,
                };
              })}
              vehicleCount={order.vehicleTypes?.reduce((sum, v) => sum + v.count, 0) || order.numberOfPersons}
              segment="leveren"
              isCombined={order.combinedUnloadingLeveren ?? false}
              onCombinedChange={(val) => updateOrder(order.id, { combinedUnloadingLeveren: val })}
            />
          )}

          {leverenAssignments.map((assignment, index) => {
            const driver = assignment.driverId 
              ? drivers.find(d => d.id === assignment.driverId) 
              : undefined;
            const transport = bakwagens.find(b => b.id === assignment.transportId) 
              || combis.find(c => c.id === assignment.transportId);
            
            // Bereken shop laadtijd voor deze chauffeur uit het bevestigde plan
            const shopLoad = planConfirmed ? calculateDriverShopTime({
              instructions: loadUnloadInstructions,
              assignmentId: assignment.id,
              action: 'laden',
              driverId: assignment.driverId,
              segment: 'leveren',
              transportId: assignment.transportId,
            }) : 0;

            return (
              <DriverScheduleCard
                key={`${assignment.id}-${planConfirmed}`}
                customerStartTime={order.startTime}
                customerAddress={order.endLocation || order.startLocation}
                vehicleCount={order.vehicleTypes?.reduce((sum, v) => sum + v.count, 0) || order.numberOfPersons}
                transportId={assignment.transportId}
                transportName={transport?.name}
                driverId={assignment.driverId}
                driverName={driver?.name}
                date={parseISO(order.startDate)}
                assignmentNumber={leverenAssignments.length > 1 ? index + 1 : undefined}
                segment="leveren"
                isCombined={(order.combinedUnloadingLeveren ?? false) && leverenAssignments.length >= 2}
                combinedWallClockTime={combinedLeverenResult?.combinedWallClockTime}
                timeSaved={combinedLeverenResult?.timeSaved}
                shopLoadMinutes={shopLoad}
                printContext={printContext}
              />
            );
          })}
        </div>
      )}

      {/* Wachttijd Analyse - alleen tonen als dezelfde chauffeur(s) leveren én ophalen doen */}
      {!isEditing && order.status === 'bevestigd' && leverenAssignments.length > 0 && ophalenAssignments.length > 0 && (() => {
        const leverenDriverIds = new Set(leverenAssignments.map(a => a.driverId).filter(Boolean));
        const ophalenDriverIds = new Set(ophalenAssignments.map(a => a.driverId).filter(Boolean));
        const hasSharedDriver = [...leverenDriverIds].some(id => ophalenDriverIds.has(id));
        return hasSharedDriver;
      })() && (
        <div className="mt-6">
          <WaitTimeCard
            deliveryCompleteTime={order.startTime}
            pickupStartTime={order.endTime}
            customerAddress={order.endLocation || order.startLocation}
            date={parseISO(order.startDate)}
            driverReturnsToShop={order.driverReturnsToShop}
            onOverrideChange={(value) => {
              updateOrder(order.id, { driverReturnsToShop: value });
            }}
          />
        </div>
      )}

      {/* Ritplanning Ophalen - alleen in view mode */}
      {!isEditing && order.status === 'bevestigd' && ophalenAssignments.length > 0 && (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-semibold">Ritplanning Ophalen</h3>

          {/* Gecombineerd inladen optie - alleen bij 2+ chauffeurs */}
          {ophalenAssignments.length >= 2 && (
            <CombinedUnloadingCard
              assignments={ophalenAssignments.map(a => {
                const driver = a.driverId ? drivers.find(d => d.id === a.driverId) : undefined;
                const transport = bakwagens.find(b => b.id === a.transportId) 
                  || combis.find(c => c.id === a.transportId);
                return {
                  id: a.id,
                  transportId: a.transportId,
                  driverId: a.driverId,
                  driverName: driver?.name,
                  transportName: transport?.name,
                };
              })}
              vehicleCount={order.vehicleTypes?.reduce((sum, v) => sum + v.count, 0) || order.numberOfPersons}
              segment="ophalen"
              isCombined={order.combinedUnloadingOphalen ?? false}
              onCombinedChange={(val) => updateOrder(order.id, { combinedUnloadingOphalen: val })}
            />
          )}

          {ophalenAssignments.map((assignment, index) => {
            const driver = assignment.driverId 
              ? drivers.find(d => d.id === assignment.driverId) 
              : undefined;
            const transport = bakwagens.find(b => b.id === assignment.transportId) 
              || combis.find(c => c.id === assignment.transportId);

            // Bereken shop lostijd voor deze chauffeur uit het bevestigde plan
            const shopUnload = planConfirmed ? calculateDriverShopTime({
              instructions: loadUnloadInstructions,
              assignmentId: assignment.id,
              action: 'lossen',
              driverId: assignment.driverId,
              segment: 'ophalen',
              transportId: assignment.transportId,
            }) : 0;

            const shopUnloadWinkel = planConfirmed ? calculateDriverShopTime({
              instructions: loadUnloadInstructions,
              assignmentId: assignment.id,
              action: 'lossen',
              driverId: assignment.driverId,
              segment: 'ophalen',
              transportId: assignment.transportId,
              location: 'winkel',
            }) : 0;

            const shopUnloadLoods = planConfirmed ? calculateDriverShopTime({
              instructions: loadUnloadInstructions,
              assignmentId: assignment.id,
              action: 'lossen',
              driverId: assignment.driverId,
              segment: 'ophalen',
              transportId: assignment.transportId,
              location: 'loods',
            }) : 0;

            return (
              <DriverScheduleCard
                key={`${assignment.id}-${planConfirmed}`}
                customerStartTime={order.endTime}
                customerAddress={order.startLocation || order.endLocation}
                vehicleCount={order.vehicleTypes?.reduce((sum, v) => sum + v.count, 0) || order.numberOfPersons}
                transportId={assignment.transportId}
                transportName={transport?.name}
                driverId={assignment.driverId}
                driverName={driver?.name}
                date={parseISO(order.endDate)}
                assignmentNumber={ophalenAssignments.length > 1 ? index + 1 : undefined}
                segment="ophalen"
                isCombined={(order.combinedUnloadingOphalen ?? false) && ophalenAssignments.length >= 2}
                combinedWallClockTime={combinedOphalenResult?.combinedWallClockTime}
                timeSaved={combinedOphalenResult?.timeSaved}
                shopUnloadMinutes={shopUnload}
                shopUnloadWinkelMinutes={shopUnloadWinkel}
                shopUnloadLoodsMinutes={shopUnloadLoods}
                printContext={printContext}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
