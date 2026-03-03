import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarIcon, Plus, Timer, ChevronDown, ChevronUp } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { OrderFormData, generateOrderNumber } from '@/data/ordersData';
import { VehicleType } from '@/data/transportData';
import { VehicleSelector, VehicleSelection } from './VehicleSelector';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Label } from '@/components/ui/label';

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
});

type OrderFormValues = z.infer<typeof orderFormSchema>;

interface OrderFormProps {
  onSubmit: (order: OrderFormData) => void;
}

export function OrderForm({ onSubmit }: OrderFormProps) {
  const [open, setOpen] = useState(false);
  const [vehicleTypes, setVehicleTypes] = useState<VehicleSelection[]>([]);
  const [showTimeWindows, setShowTimeWindows] = useState(false);
  const [deliveryWindowStart, setDeliveryWindowStart] = useState('');
  const [deliveryWindowEnd, setDeliveryWindowEnd] = useState('');
  const [pickupWindowStart, setPickupWindowStart] = useState('');
  const [pickupWindowEnd, setPickupWindowEnd] = useState('');
  const form = useForm<OrderFormValues>({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      companyName: '',
      numberOfPersons: 12,
      startTime: '10:00',
      endTime: '17:00',
      startLocation: '',
      endLocation: '',
      notes: '',
    },
  });

  const handleSubmit = (values: OrderFormValues) => {
    const now = new Date().toISOString();
    const newOrder: OrderFormData = {
      id: `order-${Date.now()}`,
      orderNumber: generateOrderNumber(),
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
      vehicleTypes: vehicleTypes,
      deliveryWindowStart: deliveryWindowStart || null,
      deliveryWindowEnd: deliveryWindowEnd || null,
      pickupWindowStart: pickupWindowStart || null,
      pickupWindowEnd: pickupWindowEnd || null,
      status: 'offerte',
      createdAt: now,
      updatedAt: now,
    };

    onSubmit(newOrder);
    form.reset();
    setVehicleTypes([]);
    setDeliveryWindowStart('');
    setDeliveryWindowEnd('');
    setPickupWindowStart('');
    setPickupWindowEnd('');
    setShowTimeWindows(false);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Nieuwe order
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nieuwe order aanmaken</DialogTitle>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Klantgegevens */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Klantgegevens
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Voornaam *</FormLabel>
                      <FormControl>
                        <Input placeholder="Voornaam" {...field} />
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
                        <Input placeholder="Achternaam" {...field} />
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
                        <Input type="email" placeholder="E-mailadres" {...field} />
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
                        <Input placeholder="Telefoonnummer" {...field} />
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
                      <Input placeholder="Bedrijfsnaam" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Boeking details */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Boeking details
              </h3>

              <FormField
                control={form.control}
                name="numberOfPersons"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Aantal personen (minimaal 12) *</FormLabel>
                    <FormControl>
                      <Input type="number" min={12} placeholder="Aantal personen" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
                            disabled={(date) => date < new Date()}
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
                            disabled={(date) => date < new Date()}
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
                      <FormLabel>Startlocatie *</FormLabel>
                      <FormControl>
                        <Input placeholder="Startlocatie" {...field} />
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
                      <FormLabel>Eindlocatie *</FormLabel>
                      <FormControl>
                        <Input placeholder="Eindlocatie" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Voertuigen */}
            <div className="space-y-4">
              <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
                Voertuigen
              </h3>
              <VehicleSelector 
                value={vehicleTypes} 
                onChange={setVehicleTypes} 
              />
            </div>

            {/* Extra */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bericht/opmerking/vraag</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Typ hier jouw bericht..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Klant-flexibiliteit */}
            <Collapsible open={showTimeWindows} onOpenChange={setShowTimeWindows}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" type="button" className="w-full justify-between text-sm gap-2">
                  <div className="flex items-center gap-2">
                    <Timer className="h-4 w-4" />
                    Klant-tijdvensters (optioneel)
                  </div>
                  {showTimeWindows ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-3 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Geef aan wanneer de klant beschikbaar is voor levering en ophaling, los van de boekingstijden.
                </p>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Levervenster</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={deliveryWindowStart}
                      onChange={(e) => setDeliveryWindowStart(e.target.value)}
                      className="w-32 h-9"
                      placeholder="Van"
                    />
                    <span className="text-sm text-muted-foreground">tot</span>
                    <Input
                      type="time"
                      value={deliveryWindowEnd}
                      onChange={(e) => setDeliveryWindowEnd(e.target.value)}
                      className="w-32 h-9"
                      placeholder="Tot"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Ophaalvenster</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={pickupWindowStart}
                      onChange={(e) => setPickupWindowStart(e.target.value)}
                      className="w-32 h-9"
                      placeholder="Van"
                    />
                    <span className="text-sm text-muted-foreground">tot</span>
                    <Input
                      type="time"
                      value={pickupWindowEnd}
                      onChange={(e) => setPickupWindowEnd(e.target.value)}
                      className="w-32 h-9"
                      placeholder="Tot"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>


            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Annuleren
              </Button>
              <Button type="submit">Order aanmaken</Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
