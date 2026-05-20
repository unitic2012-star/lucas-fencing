# LAIFC Fencing Live

An iPad-focused fencing competition prototype modeled after a Fencing Time Live style workflow.

- Fencers check in by entering full name and rating
- New names entered once are remembered locally for future autocomplete
- Optional local-only autocomplete seed files can be kept out of GitHub
- Pooling supports snake seeding or grouping similar ratings together
- Coaches can drag fencers or use dropdowns to adjust pools manually
- Pool bout scores are entered manually
- After pools, choose either Double DE Tableau or a second round of 15-touch pools

## Usage

Open `index.html` in a browser. Data is stored in browser `localStorage`, so refreshing the page keeps the current event state.

The check-in page only requires full name and rating; club is optional. Autocomplete can fill the full name, but the fencer still selects their rating on site.

## Post-Pool Formats

- Double DE Tableau: seeds from pool results into a winner bracket, loser bracket, and Grand Final. One loss drops a fencer to the loser bracket; a second loss eliminates them.
- Second 15-Touch Pools: snake-seeds fencers from the first pool results into new pools, with all bouts scored to 15.

## Future Extensions

- Backend accounts, events, and fencer database
- Real-time sync across multiple iPads
- Fencer self-entry with coach approval
- Full DE lock-in, referee assignment, and piste assignment
- PDF/print export and public schedule pages
