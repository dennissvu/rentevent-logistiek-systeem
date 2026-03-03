import { useParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ArrowLeft, CheckCircle2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useOrders } from '@/context/OrdersContext';
import { useOrderSignatures } from '@/hooks/useOrderSignatures';
import { vehicleTypes } from '@/data/transportData';

export default function SignedAgreementView() {
  const { orderId } = useParams<{ orderId: string }>();
  const { orders } = useOrders();
  const { signatures, isLoading } = useOrderSignatures(orderId || '');

  const order = orders.find(o => o.id === orderId);
  const leverenSignature = signatures.find(s => s.segment === 'leveren');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!order || !leverenSignature) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Overeenkomst niet gevonden</p>
      </div>
    );
  }

  const vehicleSummary = (order.vehicleTypes || [])
    .map(v => {
      const info = vehicleTypes.find(vt => vt.id === v.type);
      return `${v.count}x ${info?.name || v.type}`;
    })
    .join(', ');

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-20 bg-primary text-primary-foreground px-4 py-3 shadow-md print:hidden">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => window.close()}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-bold">Getekende Verhuurovereenkomst</span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => window.print()}
          >
            Afdrukken
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Status */}
        <div className="flex items-center gap-3 text-green-700 bg-green-50 border border-green-200 rounded-lg p-4">
          <CheckCircle2 className="h-6 w-6 shrink-0" />
          <div>
            <p className="font-semibold">Ondertekend door {leverenSignature.signerName}</p>
            <p className="text-sm">
              {format(parseISO(leverenSignature.signedAt), "EEEE d MMMM yyyy 'om' HH:mm", { locale: nl })}
            </p>
          </div>
        </div>

        {/* Order info */}
        <Card>
          <CardContent className="p-5 space-y-3">
            <h2 className="font-bold text-lg">Ordergegevens</h2>
            <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
              <span className="text-muted-foreground">Ordernummer</span>
              <span className="font-medium">{order.orderNumber}</span>

              <span className="text-muted-foreground">Klant</span>
              <span className="font-medium">{order.companyName || `${order.firstName} ${order.lastName}`}</span>

              <span className="text-muted-foreground">Voertuigen</span>
              <span className="font-medium">{vehicleSummary || '—'}</span>

              <span className="text-muted-foreground">Huurperiode</span>
              <span className="font-medium">
                {format(parseISO(order.startDate), 'd MMM yyyy', { locale: nl })} – {format(parseISO(order.endDate), 'd MMM yyyy', { locale: nl })}
              </span>

              <span className="text-muted-foreground">Locatie</span>
              <span className="font-medium">{order.startLocation}</span>
            </div>
          </CardContent>
        </Card>

        {/* Rental terms */}
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="font-bold text-lg">Verhuurvoorwaarden</h2>
            </div>
            <div className="text-sm space-y-3">
              <p className="font-semibold">Artikel 1 – Verhuurovereenkomst</p>
              <p>Door ondertekening van deze overeenkomst verklaart de huurder de gehuurde voertuigen in goede staat te hebben ontvangen en akkoord te gaan met onderstaande voorwaarden.</p>
              <p className="font-semibold">Artikel 2 – Zorgplicht</p>
              <p>De huurder is verantwoordelijk voor het juiste gebruik van de gehuurde voertuigen gedurende de huurperiode. Schade door nalatigheid of opzet komt voor rekening van de huurder.</p>
              <p className="font-semibold">Artikel 3 – Aansprakelijkheid</p>
              <p>De huurder is aansprakelijk voor schade aan, verlies of diefstal van de gehuurde voertuigen gedurende de huurperiode. Bij schade wordt de vervangingswaarde in rekening gebracht.</p>
              <p className="font-semibold">Artikel 4 – Gebruik</p>
              <p>De voertuigen mogen uitsluitend worden gebruikt op paden en wegen die hiervoor geschikt zijn. Het is niet toegestaan de voertuigen onder te verhuren aan derden.</p>
              <p className="font-semibold">Artikel 5 – Retournering</p>
              <p>De voertuigen dienen op het afgesproken tijdstip en de afgesproken locatie te worden geretourneerd in dezelfde staat als bij ontvangst.</p>
            </div>
          </CardContent>
        </Card>

        {/* Signature */}
        <Card>
          <CardContent className="p-5">
            <h2 className="font-bold text-lg mb-3">Handtekening</h2>
            <div className="border rounded-lg p-4 bg-white">
              <img
                src={leverenSignature.signatureUrl}
                alt={`Handtekening van ${leverenSignature.signerName}`}
                className="max-h-40 mx-auto"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2 text-center">
              {leverenSignature.signerName} — {format(parseISO(leverenSignature.signedAt), "d MMMM yyyy HH:mm", { locale: nl })}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
