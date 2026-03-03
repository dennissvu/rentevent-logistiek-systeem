import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPin, Truck, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Order, DeliverySegment } from '@/data/planningData';
import { vehicleTypes } from '@/data/transportData';
import { useTransport } from '@/context/TransportContext';

interface OrderCardProps {
  order: Order;
  onAssignSegment: (segmentId: string, transportId: string, driverId: string) => void;
}

export function OrderCard({ order, onAssignSegment }: OrderCardProps) {
  const navigate = useNavigate();
  const { allTransportMaterials, combis, drivers } = useTransport();
  const allTransport = [...allTransportMaterials, ...combis];
  
  const getVehicleIcon = (type: string) => {
    return vehicleTypes.find(v => v.id === type)?.icon || '🚲';
  };

  // Voertuigen samenvatten (eerste segment, want meestal hetzelfde)
  const vehicleSummary = order.segments[0]?.vehicleTypes || [];

  const renderSegmentRow = (segment: DeliverySegment) => {
    const assignedTransportName = allTransport.find(t => t.id === segment.assignedTransport)?.name;
    const assignedDriverName = drivers.find(d => d.id === segment.assignedDriver)?.name;
    const isLeveren = segment.type === 'leveren';

    return (
      <div key={segment.id} className="flex items-center gap-2 py-2 border-b last:border-b-0">
        {/* Type label */}
        <Badge 
          variant="outline" 
          className={`w-16 justify-center text-xs ${isLeveren ? 'border-green-500 text-green-600' : 'border-blue-500 text-blue-600'}`}
        >
          {isLeveren ? 'Leveren' : 'Ophalen'}
        </Badge>

        {/* Tijd */}
        <span className="font-medium text-sm w-12">{segment.startTime}</span>

        {/* Toewijzing */}
        {segment.status === 'assigned' ? (
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3 text-muted-foreground" />
              <span className="font-medium">{assignedDriverName}</span>
            </div>
            <span className="text-muted-foreground truncate max-w-24">{assignedTransportName}</span>
          </div>
        ) : (
          <div className="flex gap-1">
            <Select>
              <SelectTrigger className="h-6 w-20 text-xs">
                <SelectValue placeholder="Transport" />
              </SelectTrigger>
              <SelectContent>
                {allTransport.map(t => (
                  <SelectItem key={t.id} value={t.id} className="text-xs">
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select>
              <SelectTrigger className="h-6 w-20 text-xs">
                <SelectValue placeholder="Chauffeur" />
              </SelectTrigger>
              <SelectContent>
                {drivers.filter(d => d.available).map(d => (
                  <SelectItem key={d.id} value={d.id} className="text-xs">
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="border-l-4 border-l-primary">
      <CardContent className="p-3">
        {/* Header: Order info + adres + voertuigen */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <Button
              variant="link"
              className="text-sm font-semibold text-primary p-0 h-auto"
              onClick={() => navigate(`/orders/${order.id}`)}
            >
              {order.orderNumber}
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>
            <span className="font-medium">{order.customerName}</span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>{order.address}</span>
            </div>
          </div>
          <div className="flex gap-1">
            {vehicleSummary.map((v, i) => (
              <Badge key={i} variant="secondary" className="text-xs py-0">
                {getVehicleIcon(v.type)} {v.count}x
              </Badge>
            ))}
          </div>
        </div>

        {/* Segments */}
        <div className="divide-y">
          {order.segments
            .sort((a, b) => a.startTime.localeCompare(b.startTime))
            .map(segment => renderSegmentRow(segment))}
        </div>
      </CardContent>
    </Card>
  );
}
