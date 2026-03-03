import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Clock, Phone, User, Truck } from 'lucide-react';
import { Delivery } from '@/data/planningData';
import { vehicleTypes } from '@/data/transportData';
import { useTransport } from '@/context/TransportContext';

interface DeliveryCardProps {
  delivery: Delivery;
  onAssign: (deliveryId: string, transportId: string, driverId: string) => void;
}

export function DeliveryCard({ delivery, onAssign }: DeliveryCardProps) {
  const { allTransportMaterials, combis, drivers } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];
  
  const getStatusColor = (status: Delivery['status']) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-700 border-yellow-500/30';
      case 'assigned': return 'bg-blue-500/20 text-blue-700 border-blue-500/30';
      case 'in-progress': return 'bg-orange-500/20 text-orange-700 border-orange-500/30';
      case 'completed': return 'bg-green-500/20 text-green-700 border-green-500/30';
    }
  };

  const getStatusLabel = (status: Delivery['status']) => {
    switch (status) {
      case 'pending': return 'Niet toegewezen';
      case 'assigned': return 'Toegewezen';
      case 'in-progress': return 'Onderweg';
      case 'completed': return 'Afgerond';
    }
  };

  const getTotalVehicles = () => {
    return delivery.vehicleTypes.reduce((sum, v) => sum + v.count, 0);
  };

  const getVehicleIcon = (type: string) => {
    return vehicleTypes.find(v => v.id === type)?.icon || '🚲';
  };

  const assignedTransportName = allTransport.find(t => t.id === delivery.assignedTransport)?.name;
  const assignedDriverName = drivers.find(d => d.id === delivery.assignedDriver)?.name;

  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-sm font-medium text-primary mb-1">{delivery.orderNumber}</div>
            <CardTitle className="text-lg">{delivery.customerName}</CardTitle>
            {delivery.customerPhone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                <Phone className="h-3 w-3" />
                {delivery.customerPhone}
              </div>
            )}
          </div>
          <Badge className={getStatusColor(delivery.status)}>
            {getStatusLabel(delivery.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Voertuigen */}
        <div className="flex flex-wrap gap-2">
          {delivery.vehicleTypes.map((v, i) => (
            <Badge key={i} variant="secondary" className="gap-1">
              {getVehicleIcon(v.type)} {v.count}x {vehicleTypes.find(vt => vt.id === v.type)?.name}
            </Badge>
          ))}
          <Badge variant="outline" className="font-semibold">
            Totaal: {getTotalVehicles()} voertuigen
          </Badge>
        </div>

        {/* Locaties & Tijden */}
        <div className="grid gap-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-green-600">
              <MapPin className="h-4 w-4" />
              <Clock className="h-3 w-3" />
            </div>
            <span className="font-medium">{delivery.startTime}</span>
            <span className="text-muted-foreground">{delivery.startLocation}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-red-600">
              <MapPin className="h-4 w-4" />
              <Clock className="h-3 w-3" />
            </div>
            <span className="font-medium">{delivery.endTime}</span>
            <span className="text-muted-foreground">{delivery.endLocation}</span>
          </div>
        </div>

        {/* Toewijzing */}
        {delivery.status === 'assigned' ? (
          <div className="flex gap-4 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-4 w-4 text-primary" />
              <span className="font-medium">{assignedTransportName}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-primary" />
              <span className="font-medium">{assignedDriverName}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 pt-2 border-t">
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Transportmiddel..." />
              </SelectTrigger>
              <SelectContent>
                {allTransport.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger>
                <SelectValue placeholder="Chauffeur..." />
              </SelectTrigger>
              <SelectContent>
                {drivers.filter(d => d.available).map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
