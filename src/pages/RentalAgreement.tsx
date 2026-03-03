import { useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { ArrowLeft, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { SignaturePad } from '@/components/signatures/SignaturePad';
import { useOrders } from '@/context/OrdersContext';
import { useOrderSignatures } from '@/hooks/useOrderSignatures';
import { vehicleTypes } from '@/data/transportData';

export default function RentalAgreement() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { orders } = useOrders();
  const { signatures, saveSignature } = useOrderSignatures(orderId || '');

  const segment = searchParams.get('segment') || 'leveren';
  const driverId = searchParams.get('driver') || undefined;

  const order = orders.find(o => o.id === orderId);
  const [signerName, setSignerName] = useState('');
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [signed, setSigned] = useState(false);

  const existingSignature = signatures.find(s => s.segment === segment);

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <p className="text-muted-foreground">Order niet gevonden</p>
      </div>
    );
  }

  const vehicleSummary = (order.vehicleTypes || [])
    .map(v => {
      const info = vehicleTypes.find(vt => vt.id === v.type);
      return `${v.count}x ${info?.name || v.type}`;
    })
    .join(', ');

  const handleSign = async () => {
    if (!signatureData || !signerName.trim() || !orderId) return;
    await saveSignature.mutateAsync({
      orderId,
      signerName: signerName.trim(),
      signatureDataUrl: signatureData,
      segment,
      driverId,
    });
    setSigned(true);
  };

  if (signed || existingSignature) {
    return (
      <div className="min-h-screen bg-background">
        <div className="sticky top-0 z-20 bg-primary text-primary-foreground px-4 py-3 shadow-md">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-bold">Verhuurovereenkomst</span>
          </div>
        </div>
        <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
          <CheckCircle2 className="h-20 w-20 text-green-500 mx-auto" />
          <h2 className="text-2xl font-bold">Ondertekend!</h2>
          <p className="text-muted-foreground">
            De verhuurovereenkomst voor order {order.orderNumber} is succesvol ondertekend
            {existingSignature ? ` door ${existingSignature.signerName}` : signerName ? ` door ${signerName}` : ''}.
          </p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            Terug naar ritten
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-primary text-primary-foreground px-4 py-3 shadow-md">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <span className="font-bold">Verhuurovereenkomst</span>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-5">
        {/* Order info */}
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-lg">{order.orderNumber}</span>
              <span className="text-sm text-muted-foreground">
                {format(parseISO(order.startDate), 'd MMMM yyyy', { locale: nl })}
              </span>
            </div>
            <p className="font-medium">
              {order.companyName || `${order.firstName} ${order.lastName}`}
            </p>
            <p className="text-sm text-muted-foreground">{vehicleSummary}</p>
            <p className="text-sm text-muted-foreground">
              {order.startTime} – {order.endTime}
            </p>
          </CardContent>
        </Card>

        {/* Rental terms */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-5 w-5 text-primary" />
              <h3 className="font-bold">Verhuurvoorwaarden</h3>
            </div>
            <div className="text-sm space-y-3 max-h-[300px] overflow-y-auto pr-2">
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

        {/* Signer name */}
        <div className="space-y-2">
          <Label htmlFor="signerName" className="text-base font-medium">
            Naam ondertekenaar
          </Label>
          <Input
            id="signerName"
            value={signerName}
            onChange={(e) => setSignerName(e.target.value)}
            placeholder="Volledige naam"
            className="h-12 text-base"
          />
        </div>

        {/* Signature pad */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Handtekening</Label>
          <SignaturePad onSignatureChange={setSignatureData} height={180} />
        </div>

        {/* Sign button */}
        <Button
          className="w-full h-14 text-lg"
          disabled={!signatureData || !signerName.trim() || saveSignature.isPending}
          onClick={handleSign}
        >
          {saveSignature.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
              Opslaan...
            </>
          ) : (
            'Ondertekenen'
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground pb-4">
          Door te ondertekenen gaat u akkoord met de bovenstaande verhuurvoorwaarden.
        </p>
      </div>
    </div>
  );
}
