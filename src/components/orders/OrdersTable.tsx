import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Mail, Phone, Building2, MapPin, Clock, ChevronDown, ExternalLink, ArrowUp, ArrowDown, ArrowUpDown, Truck, User, Package, RotateCcw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { OrderFormData, getStatusColor, getStatusLabel, orderStatuses } from '@/data/ordersData';
import { SortField, SortDirection } from './OrderFilters';
import { useAllOrderAssignments } from '@/hooks/useAllOrderAssignments';
import { useTransport } from '@/context/TransportContext';

interface OrdersTableProps {
  orders: OrderFormData[];
  onStatusChange: (id: string, status: OrderFormData['status']) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
}

export function OrdersTable({ orders, onStatusChange, sortField, sortDirection, onSortChange }: OrdersTableProps) {
  const navigate = useNavigate();
  const orderIds = orders.map(o => o.id);
  const { data: assignmentsMap } = useAllOrderAssignments(orderIds);
  const { allTransportMaterials, combis, drivers } = useTransport();

  // Helper to get transport name by ID
  const getTransportName = (transportId: string) => {
    const material = allTransportMaterials.find(m => m.id === transportId);
    if (material) return material.name;
    const combi = combis.find(c => c.id === transportId);
    if (combi) return combi.name;
    return transportId;
  };

  // Helper to get driver name by ID
  const getDriverName = (driverId: string | null) => {
    if (!driverId) return null;
    const driver = drivers.find(d => d.id === driverId);
    return driver?.name || driverId;
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground/50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="ml-1 h-3 w-3" />
      : <ArrowDown className="ml-1 h-3 w-3" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-3 h-8 hover:bg-transparent"
      onClick={() => onSortChange(field)}
    >
      {children}
      <SortIcon field={field} />
    </Button>
  );

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Geen orders gevonden.</p>
      </div>
    );
  }

  const handleRowClick = (orderId: string) => {
    navigate(`/orders/${orderId}`);
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              <SortableHeader field="orderNumber">Order</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="name">Klant</SortableHeader>
            </TableHead>
            <TableHead>
              <SortableHeader field="date">Datum & Tijd</SortableHeader>
            </TableHead>
            <TableHead>Locatie</TableHead>
            <TableHead>Voertuigen</TableHead>
            <TableHead>Transport & Chauffeur</TableHead>
            <TableHead>
              <SortableHeader field="status">Status</SortableHeader>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const assignments = assignmentsMap?.get(order.id);
            const hasLeverenAssignment = assignments && assignments.leveren.transportIds.length > 0;
            const hasOphalenAssignment = assignments && assignments.ophalen.transportIds.length > 0;
            
            return (
              <TableRow 
                key={order.id} 
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(order.id)}
              >
                <TableCell>
                  <div className="font-medium">{order.orderNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {format(parseISO(order.createdAt), 'dd MMM yyyy', { locale: nl })}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {order.firstName} {order.lastName}
                    </div>
                    {order.companyName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" />
                        {order.companyName}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {order.email}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {order.phone}
                      </span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1">
                    <div className="font-medium">
                      {format(parseISO(order.startDate), 'EEE dd MMM yyyy', { locale: nl })}
                    </div>
                    {order.startDate !== order.endDate && (
                      <div className="text-xs text-muted-foreground">
                        t/m {format(parseISO(order.endDate), 'EEE dd MMM yyyy', { locale: nl })}
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {order.startTime} - {order.endTime}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-600" />
                      <span className="text-xs text-muted-foreground w-14">Leveren:</span>
                      <span className="truncate max-w-[180px]">{order.startLocation}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-blue-600" />
                      <span className="text-xs text-muted-foreground w-14">Ophalen:</span>
                      <span className="truncate max-w-[180px]">{order.endLocation}</span>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {order.vehicleTypes && order.vehicleTypes.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {order.vehicleTypes.map((vt, idx) => (
                        <span key={idx} className="text-xs bg-muted px-1.5 py-0.5 rounded whitespace-nowrap">
                          {vt.count}× {vt.type.replace('e-', '').replace('tweepersoons', '2-pers')}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="space-y-1.5 text-xs min-w-[160px]">
                    {/* Leveren */}
                    <div className="flex items-start gap-1.5">
                      <Package className="h-3 w-3 text-emerald-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        {hasLeverenAssignment ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">
                                {assignments.leveren.transportIds.map(id => getTransportName(id)).join(', ')}
                              </span>
                            </div>
                            {assignments.leveren.driverIds.some(d => d) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span className="truncate">
                                  {assignments.leveren.driverIds
                                    .filter(d => d)
                                    .map(d => getDriverName(d))
                                    .join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Niet toegewezen</span>
                        )}
                      </div>
                    </div>
                    {/* Ophalen */}
                    <div className="flex items-start gap-1.5">
                      <RotateCcw className="h-3 w-3 text-red-500 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        {hasOphalenAssignment ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Truck className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate">
                                {assignments.ophalen.transportIds.map(id => getTransportName(id)).join(', ')}
                              </span>
                            </div>
                            {assignments.ophalen.driverIds.some(d => d) && (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                <span className="truncate">
                                  {assignments.ophalen.driverIds
                                    .filter(d => d)
                                    .map(d => getDriverName(d))
                                    .join(', ')}
                                </span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">Niet toegewezen</span>
                        )}
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        className={`h-6 px-1.5 text-xs font-medium ${getStatusColor(order.status)}`}
                      >
                        {getStatusLabel(order.status).substring(0, 3).toUpperCase()}
                        <ChevronDown className="ml-0.5 h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="bg-background border shadow-lg z-50">
                      {orderStatuses.map((status) => (
                        <DropdownMenuItem
                          key={status.value}
                          onClick={() => onStatusChange(order.id, status.value)}
                          className={`cursor-pointer ${order.status === status.value ? 'bg-muted' : ''}`}
                        >
                          <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                            status.value === 'offerte' ? 'bg-amber-500' :
                            status.value === 'optie' ? 'bg-purple-500' :
                            'bg-emerald-500'
                          }`} />
                          {status.label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
                <TableCell>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
