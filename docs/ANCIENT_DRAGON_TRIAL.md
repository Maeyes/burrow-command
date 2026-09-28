# Ancient Dragon combat trial — local v0.6.9

Open the game in daylight, close management dialogs, and select `🐲 ทดลองบอส`.
The entrance shows two shadow passes, optional dimming, a landing, and a boss encounter banner.
After the entrance, existing rabbits fight a temporary dragon using the regular combat routines.
The dragon alternates telegraphed Ground Slam and Meteor using the existing skill FX sheets.

This trial has no rewards and does not advance waves. Exit with Escape or the close button.
Army state, inventory, gold, progression, simulation time, original monsters and queued events are restored.
Saving is suppressed during the combat trial. The trial itself is not saved.

Art: generated dragon image, runtime polygon crop, eight cached transform frames.
These are pose transforms of one illustration, not independently painted limb animation frames.
The silhouette crop is provisional. Difficulty uses temporary army-scaled HP and damage.

Verification: production build passed; 376 existing unit tests passed; desktop browser confirmed
entrance-to-combat, boss HP reduction (500 to 291 then 84), party defeat and exit restoring
the displayed gold (20), burrow HP (500/500), and two original rabbits. No browser errors observed.
Victory and mobile layouts have not yet been explicitly exercised.

Not deployed. Other Home Builder and guide changes are in progress in this working tree.
