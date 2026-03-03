import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, FileText, CheckCircle, Clock } from 'lucide-react';
import { parseISO } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrdersTable } from '@/components/orders/OrdersTable';
import { OrderFilters, SortField, SortDirection } from '@/components/orders/OrderFilters';
import { useOrders } from '@/context/OrdersContext';
import { OrderFormData } from '@/data/ordersData';

export default function Orders() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filterParam = searchParams.get('filter');
  const initialUnassignedFilter = filterParam === 'unassigned';
  const initialStatusFilter = ['offerte', 'optie', 'bevestigd'].includes(filterParam || '') ? filterParam : undefined;
  const { orders, isLoading, error, addOrder, updateOrder } = useOrders();
  const [filteredOrders, setFilteredOrders] = useState<OrderFormData[]>([]);
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  // Sort orders
  const sortOrders = (ordersToSort: OrderFormData[]): OrderFormData[] => {
    return [...ordersToSort].sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'date':
          comparison = parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime();
          break;
        case 'name':
          const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
          const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
          comparison = nameA.localeCompare(nameB);
          break;
        case 'status':
          const statusOrder = { offerte: 0, optie: 1, bevestigd: 2 };
          comparison = statusOrder[a.status] - statusOrder[b.status];
          break;
        case 'orderNumber':
          comparison = a.orderNumber.localeCompare(b.orderNumber);
          break;
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  // Update filtered orders when orders change
  useEffect(() => {
    setFilteredOrders(sortOrders(orders));
  }, [orders, sortField, sortDirection]);

  const handleFilteredOrdersChange = (filtered: OrderFormData[]) => {
    setFilteredOrders(sortOrders(filtered));
  };

  const handleSortChange = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Statistieken berekenen (op alle orders)
  const totalOrders = orders.length;
  const offerteCount = orders.filter((o) => o.status === 'offerte').length;
  const optieCount = orders.filter((o) => o.status === 'optie').length;
  const bevestigdCount = orders.filter((o) => o.status === 'bevestigd').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-muted-foreground">Orders laden...</div>
      </div>
    );
  }

  if (error) {
    const is401 = /401|Unauthorized|invalid.*key|JWT/i.test(error.message);
    return (
      <div className="space-y-4 max-w-2xl">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Orders konden niet worden geladen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-muted-foreground">{error.message}</p>
            {is401 ? (
              <p className="text-sm text-muted-foreground space-y-1">
                <span className="block">Mogelijke oorzaken:</span>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>Verkeerde of oude anon key → Project Settings → API, kopieer opnieuw <strong>anon public</strong> naar <code className="bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> in <code className="bg-muted px-1 rounded">.env</code> / <code className="bg-muted px-1 rounded">.env.local</code></li>
                  <li>URL met trailing slash → gebruik <code className="bg-muted px-1 rounded">https://xxx.supabase.co</code> zonder slash aan het eind</li>
                  <li>Anon-role uitgeschakeld of RLS blokkeert anon → in het dashboard: controleer of anon toegang mag hebben tot de <code className="bg-muted px-1 rounded">orders</code>-tabel (RLS-policies)</li>
                </ul>
                Herstart na wijziging de dev-server.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Controleer of de app verbonden is met het juiste Supabase-project. In <code className="bg-muted px-1 rounded">.env</code> of <code className="bg-muted px-1 rounded">.env.local</code>:{" "}
                <code className="bg-muted px-1 rounded">VITE_SUPABASE_URL</code> en{" "}
                <code className="bg-muted px-1 rounded">VITE_SUPABASE_PUBLISHABLE_KEY</code> moeten bij dat project horen.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground">
            Beheer alle boekingen en orders
          </p>
        </div>
        <OrderForm onSubmit={addOrder} />
      </div>

      {/* Statistieken */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${!filterParam ? 'ring-2 ring-primary' : ''}`}
          onClick={() => setSearchParams({})}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Totaal Orders</CardTitle>
            <ClipboardList className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterParam === 'offerte' ? 'ring-2 ring-amber-500' : ''}`}
          onClick={() => setSearchParams({ filter: 'offerte' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Offertes</CardTitle>
            <FileText className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{offerteCount}</div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterParam === 'optie' ? 'ring-2 ring-purple-500' : ''}`}
          onClick={() => setSearchParams({ filter: 'optie' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Opties</CardTitle>
            <Clock className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{optieCount}</div>
          </CardContent>
        </Card>

        <Card 
          className={`cursor-pointer transition-all hover:shadow-md ${filterParam === 'bevestigd' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => setSearchParams({ filter: 'bevestigd' })}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bevestigd</CardTitle>
            <CheckCircle className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{bevestigdCount}</div>
          </CardContent>
        </Card>
      </div>


      {/* Filters */}
      <OrderFilters 
        orders={orders} 
        onFilteredOrdersChange={handleFilteredOrdersChange}
        sortField={sortField}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        initialUnassignedFilter={initialUnassignedFilter}
        initialStatusFilter={initialStatusFilter}
      />

      {/* Orders tabel */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            {filteredOrders.length === orders.length
              ? `Alle orders (${orders.length})`
              : `${filteredOrders.length} van ${orders.length} orders`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <OrdersTable 
            orders={filteredOrders} 
            onStatusChange={(id, status) => updateOrder(id, { status })}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
        </CardContent>
      </Card>
    </div>
  );
}
