# PaladinAura

**VERSION:** 1.0.11

A roll20 API for 5E D&D that automatically adjusts the saving throw bonuses of Paladins and those close to them.

The API takes into account the paladin's level, and whether the bonus has already been applied. After rigorous testing there have been no accidental double-applies of bonuses.

Note:

- The API will only run on the player-ribbon page.
- The API will not run on pages which have their scale unit set to anything other than "ft".

**WARNING:** This API currently only works with [Roll20's 5E OGL D&D Character Sheet](https://wiki.roll20.net/5th_Edition_OGL_by_Roll20) and, like all API, requires a Pro Subscription to use.

### [Problems and Feedback](#Feedback)

## Installation

To install any API (this one included) navigate to your Roll20 game page and select Settings > API Scripts.

Once there do the following:

1. Click "New Script".
2. Name the script. This name does not matter.
3. Copy the contents of [PaladinAura.js](https://github.com/LaytonGB/PaladinAura/raw/master/PaladinAura.js).
4. Paste it into the code section of the script tab you have created on Roll20.

## How to Use

The API should be ready to go immediately. However, if you wish to customize the system, or even turn it off, you can do so from the in-game commands (see [Configuration](#Settings--Configuration) below).

### Paladin Aura Toggle

Each detected paladin will gain an ability to toggle whether others are affected by their aura. This applies to both NPCs and Characters. The button that activates this ability will be at the top left of the Roll20 interface whenever a paladin token is selected.

### First time load

The first time a GM joins the game while the API is active, a few macros will be created: 

- **PaladinAuraConfig:** Shows a configuration interface.
- **PaladinAuraHelp:** Shows a help interface.
- **PaladinAuraToggle:** Toggles the API on/off.

These macros will be visible to all, but won't allow players to mess with anything that affects others.

### Settings / Configuration

There are only two settings that can be configured (currently).

1. **diagonal_calc_override:** This setting overrides the roll20 map settings for diagonal calculations. It has five acceptable values:

- **none:** Do not override any settings / use the page's configuration. (**Default and Recommended**)
- **foure:** Use 4E / 5E D&D measuring.<br>(See image 1 of the reference below)
- **threefive:** Use 3E and below D&D measuring.<br>(See image 3 of the reference below)
- **pythagorean:** Use real life measuring.
- **manhattan:** Use straight line movement only, making diagonal movement count as 2 squares.<br>(See image 2 of the reference below)

![Diagonal Movement Reference](https://i.imgur.com/tZyn79Z.png)

2. **status_marker:** This setting changes what status marker will be applied to tokens when they are under the effect of a paladin's aura.<br>**Custom status markers will show in the config menu list.**

### Feedback

[Submit an issue report or feature request.](https://github.com/LaytonGB/PaladinAura/issues/new/choose)

## Changelog

1.0.11
- Optimized API massively. 
- API will now again only run on the player-ribbon page.
- Improved code readability.

1.0.10
- Fixed charactermancer compatibility issues.
- Reduced chat output when multiple paladins are detected for the first time.

1.0.9
- Improved first-time-run message.

1.0.8
- In the config there is now a CLEAR ALL button that allows a GM to clear all PaladinAura settings, attributes, and abilities in the game.
- NPC saving throw regions no longer show on their sheet when all save bonuses are equal to their relevant attribute modifiers.

1.0.7
- Fixed status marker config error for clean installs.

1.0.6
- Paladins now have a Token Ability (ToggleAuraTarget) that allows them to toggle whether NPCs and Players receive a buff to saving throws from their Paladin Aura.

1.0.5
- API now runs on any page with active player(s).

1.0.4
- Cleaned up API Output Console feed.

1.0.3
- Added custom token-status marker integration (use `!pa config` in Roll20 to change settings).

1.0.2
- Added a bottom limit to the Aura's bonus (+1).

1.0.1
- Added token-status marker integration. When the PaladinAura affects a token that token now receives a marker with a number to represent the bonus.
