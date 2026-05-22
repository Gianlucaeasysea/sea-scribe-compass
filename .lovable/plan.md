## Problema individuato

Le credenziali Shopify sono presenti e la connessione è autorizzata: il negozio risponde e contiene 28 prodotti attivi. Il blocco attuale non è “token mancante”, ma il codice sta chiamando gli endpoint Admin `customers.json` e `orders.json`, che tornano 401/403 perché il token non ha gli scope/permessi per dati protetti clienti e ordini. In più il codice marca 401/403 genericamente come “missing scope”, quindi l’integrazione sembra completamente rotta invece di distinguere i casi.

## Piano di correzione

1. **Rendere Shopify funzionante anche senza scope clienti/ordini**
   - Mantenere l’header corretto `X-Shopify-Access-Token`.
   - Aggiungere una verifica leggera dello shop/prodotti via Admin API per confermare che token e dominio sono validi.
   - Se clienti/ordini sono bloccati da 401/403, non trattare l’intera integrazione come fallita: segnalare Shopify come connesso ma con permessi dati limitati.

2. **Importare almeno dati disponibili da Shopify**
   - Aggiungere fallback su `products.json` per sincronizzare/validare Shopify quando clienti e ordini non sono leggibili.
   - Aggiornare il messaggio di stato da “non funziona” a qualcosa di operativo, tipo: “28 prodotti disponibili · clienti/ordini richiedono permessi Shopify aggiuntivi”.

3. **Migliorare errori e diagnostica UI**
   - Distinguere: token non valido, dominio errato, scope mancanti, rate limit, errore API.
   - Evitare toast fuorvianti di errore totale quando una sorgente è parzialmente disponibile.
   - Mostrare nella scheda Shopify se l’integrazione è connessa ma limitata dai permessi.

4. **Controllare le altre integrazioni senza cambiare credenziali**
   - Lasciare Klaviyo, Facebook Ads e Circle con gli endpoint attuali, ma migliorare i messaggi quando non ci sono clienti importati da associare.
   - Verificare che la dashboard non resti a zero solo perché Shopify clienti/ordini sono bloccati.

## Dettagli tecnici

- File principale: `src/lib/sync.functions.ts`.
- File UI da rifinire: `src/routes/_authenticated/integrations.tsx`.
- Nessuna modifica ai secret: `SHOPIFY_CUSTOM_ADMIN_TOKEN` e `SHOPIFY_ACCESS_TOKEN` risultano già configurati.
- Nessuna migrazione database prevista, salvo emerga la necessità di salvare prodotti Shopify in una tabella dedicata; in questa correzione posso evitare nuove tabelle e usare lo stato integrazione esistente.

## Risultato atteso

Premendo **Connect & sync / Sync now**, Shopify non deve più apparire come “tutto rotto” se le credenziali sono valide: deve connettersi, leggere ciò che è permesso, e indicare chiaramente quali permessi Shopify mancano per clienti e ordini.