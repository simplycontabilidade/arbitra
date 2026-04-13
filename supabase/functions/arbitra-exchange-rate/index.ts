import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { supabaseAdmin } from '../_shared/supabase-client.ts';
import { jsonResponse } from '../_shared/cors.ts';

serve(async () => {
  const currencies = ['USD', 'CNY'];
  const results = [];

  for (const cur of currencies) {
    try {
      // API pública PTAX do Banco Central do Brasil
      // Formato da data: MM-DD-YYYY
      const today = new Date();
      const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;

      const url = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${cur}'&@dataCotacao='${dateStr}'&$format=json`;

      const res = await fetch(url);
      const data = await res.json();

      const cotacao = data.value?.[data.value.length - 1]; // última cotação do dia
      const rate = cotacao?.cotacaoVenda;

      if (rate) {
        await supabaseAdmin.from('exchange_rates').insert({
          currency_from: cur,
          currency_to: 'BRL',
          rate,
          source: 'bcb',
        });
        results.push({ currency: cur, rate, date: dateStr });
      } else {
        // Sem cotação hoje (feriado/fim de semana) — buscar última disponível
        // Tenta os últimos 5 dias úteis
        let found = false;
        for (let i = 1; i <= 5 && !found; i++) {
          const pastDate = new Date();
          pastDate.setDate(pastDate.getDate() - i);
          const pastStr = `${String(pastDate.getMonth() + 1).padStart(2, '0')}-${String(pastDate.getDate()).padStart(2, '0')}-${pastDate.getFullYear()}`;

          const pastUrl = `https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaDia(moeda=@moeda,dataCotacao=@dataCotacao)?@moeda='${cur}'&@dataCotacao='${pastStr}'&$format=json`;
          const pastRes = await fetch(pastUrl);
          const pastData = await pastRes.json();
          const pastCotacao = pastData.value?.[pastData.value.length - 1];

          if (pastCotacao?.cotacaoVenda) {
            await supabaseAdmin.from('exchange_rates').insert({
              currency_from: cur,
              currency_to: 'BRL',
              rate: pastCotacao.cotacaoVenda,
              source: 'bcb',
            });
            results.push({ currency: cur, rate: pastCotacao.cotacaoVenda, date: pastStr, note: 'fallback' });
            found = true;
          }
        }

        if (!found) {
          results.push({ currency: cur, error: 'Nenhuma cotação encontrada nos últimos 5 dias' });
        }
      }
    } catch (err) {
      results.push({ currency: cur, error: String(err) });
    }
  }

  return jsonResponse({ updated: results });
});
