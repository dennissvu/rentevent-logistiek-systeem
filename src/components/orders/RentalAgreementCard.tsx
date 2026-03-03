import { format, parseISO } from 'date-fns';
import { nl } from 'date-fns/locale';
import { FileSignature, CheckCircle2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useOrderSignatures } from '@/hooks/useOrderSignatures';

interface RentalAgreementCardProps {
  orderId: string;
}

export function RentalAgreementCard({ orderId }: RentalAgreementCardProps) {
  const { signatures, isLoading } = useOrderSignatures(orderId);
  const leverenSignature = signatures.find(s => s.segment === 'leveren');

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          Verhuurovereenkomst
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden...</p>
        ) : leverenSignature ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="text-sm font-medium">
                  Ondertekend door {leverenSignature.signerName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(leverenSignature.signedAt), "d MMM yyyy 'om' HH:mm", { locale: nl })}
                </p>
              </div>
            </div>
            <a
              href={`/verhuurovereenkomst/${orderId}/bekijk`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              Bekijk overeenkomst
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Nog niet ondertekend</p>
              <p className="text-xs text-muted-foreground">
                De chauffeur kan de klant laten tekenen bij aflevering
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => window.open(`/verhuurovereenkomst/${orderId}?segment=leveren`, '_blank')}
            >
              <FileSignature className="h-3.5 w-3.5" />
              Openen
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
