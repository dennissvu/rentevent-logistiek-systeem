import { useState, useEffect } from 'react';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { Search, X, CalendarIcon, Clock } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { OrderFormData, orderStatuses } from '@/data/ordersData';
import { useAllOrderAssignments } from '@/hooks/useAllOrderAssignments';

export type SortField = 'date' | 'name' | 'status' | 'orderNumber';
export type SortDirection = 'asc' | 'desc';

interface OrderFiltersProps {
  orders: OrderFormData[];
  onFilteredOrdersChange: (orders: OrderFormData[]) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
  initialUnassignedFilter?: boolean;
  initialStatusFilter?: string;
}

export function OrderFilters({ 
  orders, 
  onFilteredOrdersChange,
  sortField,
  sortDirection,
  onSortChange,
  initialUnassignedFilter = false,
  initialStatusFilter
}: OrderFiltersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter || 'all');
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [unassignedFilter, setUnassignedFilter] = useState(initialUnassignedFilter);

  // Fetch all assignments for filtering
  const orderIds = orders.map(o => o.id);
  const { data: assignmentsMap } = useAllOrderAssignments(orderIds);

  // Apply initial filters on mount or when URL params change
  useEffect(() => {
    if (initialUnassignedFilter) {
      setUnassignedFilter(true);
    }
    if (initialStatusFilter) {
      setStatusFilter(initialStatusFilter);
    } else if (!initialUnassignedFilter) {
      setStatusFilter('all');
    }
  }, [initialUnassignedFilter, initialStatusFilter]);

  const applyFilters = (
    search: string,
    status: string,
    date: Date | undefined,
    unassigned: boolean
  ) => {
    let filtered = [...orders];

    // Search filter (name, company, order number)
    if (search.trim()) {
      const query = search.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          order.firstName.toLowerCase().includes(query) ||
          order.lastName.toLowerCase().includes(query) ||
          (order.companyName?.toLowerCase().includes(query) ?? false) ||
          order.orderNumber.toLowerCase().includes(query) ||
          order.email.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (status !== 'all') {
      filtered = filtered.filter((order) => order.status === status);
    }

    // Date filter
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      filtered = filtered.filter((order) => order.startDate === dateStr);
    }

    // Unassigned filter - orders missing transport or driver in assignments table
    if (unassigned && assignmentsMap) {
      filtered = filtered.filter((order) => {
        const assignments = assignmentsMap.get(order.id);
        if (!assignments) return true; // No assignments at all
        
        // Check if leveren segment has transport AND driver
        const hasLeverenTransport = assignments.leveren.transportIds.length > 0;
        const hasLeverenDriver = assignments.leveren.driverIds.some(d => d !== null);
        
        // Check if ophalen segment has transport AND driver
        const hasOphalenTransport = assignments.ophalen.transportIds.length > 0;
        const hasOphalenDriver = assignments.ophalen.driverIds.some(d => d !== null);
        
        // Order is "unassigned" if missing transport OR driver for either segment
        return !hasLeverenTransport || !hasLeverenDriver || !hasOphalenTransport || !hasOphalenDriver;
      });
    }

    onFilteredOrdersChange(filtered);
  };

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    applyFilters(value, statusFilter, dateFilter, unassignedFilter);
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    applyFilters(searchQuery, value, dateFilter, unassignedFilter);
  };

  const handleDateChange = (date: Date | undefined) => {
    setDateFilter(date);
    applyFilters(searchQuery, statusFilter, date, unassignedFilter);
  };

  const handleUnassignedChange = (checked: boolean) => {
    setUnassignedFilter(checked);
    applyFilters(searchQuery, statusFilter, dateFilter, checked);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setDateFilter(undefined);
    setUnassignedFilter(false);
    onFilteredOrdersChange(orders);
  };

  // Trigger filter when URL params change, orders update, or assignments load
  useEffect(() => {
    applyFilters(searchQuery, statusFilter, dateFilter, unassignedFilter);
  }, [orders, statusFilter, unassignedFilter, assignmentsMap]);

  const hasActiveFilters = searchQuery || statusFilter !== 'all' || dateFilter || unassignedFilter;
  const activeFilterCount = [
    searchQuery,
    statusFilter !== 'all' ? statusFilter : null,
    dateFilter,
    unassignedFilter,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Zoek op naam, bedrijf of ordernummer..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={handleStatusChange}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle statussen</SelectItem>
            {orderStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                'w-[180px] justify-start text-left font-normal',
                !dateFilter && 'text-muted-foreground'
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateFilter ? format(dateFilter, 'dd MMM yyyy', { locale: nl }) : 'Filter op datum'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={dateFilter}
              onSelect={handleDateChange}
              initialFocus
            />
          </PopoverContent>
        </Popover>

        {/* Unassigned filter */}
        <Button
          variant={unassignedFilter ? "default" : "outline"}
          onClick={() => handleUnassignedChange(!unassignedFilter)}
          className="gap-2"
        >
          <Clock className="h-4 w-4" />
          Niet toegewezen
        </Button>

        {/* Clear filters */}
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Wis filters
          </Button>
        )}
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Actieve filters:</span>
          {searchQuery && (
            <Badge variant="secondary" className="gap-1">
              Zoeken: "{searchQuery}"
              <button onClick={() => handleSearchChange('')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== 'all' && (
            <Badge variant="secondary" className="gap-1">
              Status: {orderStatuses.find((s) => s.value === statusFilter)?.label}
              <button onClick={() => handleStatusChange('all')} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {dateFilter && (
            <Badge variant="secondary" className="gap-1">
              Datum: {format(dateFilter, 'dd MMM yyyy', { locale: nl })}
              <button onClick={() => handleDateChange(undefined)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
          {unassignedFilter && (
            <Badge variant="secondary" className="gap-1">
              Niet toegewezen
              <button onClick={() => handleUnassignedChange(false)} className="ml-1 hover:text-destructive">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
