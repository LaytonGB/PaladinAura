# PaladinAura

A roll20 API for 5E D&D that automatically adjusts the saving throw bonuses of Paladins and those close to them.

The API takes into account the paladin's level, and whether the bonus has already been applied. After rigorous testing there have been no accidental double-applies of bonuses.

**WARNING:** This API only works with [Roll20's 5E OGL D&D Character Sheet](https://wiki.roll20.net/5th_Edition_OGL_by_Roll20).

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

### First time load

The first time a GM joins the game while the API is active, a few macros will be created: 

- **PaladinAuraConfig:** Shows a configuration interface.
- **PaladinAuraHelp:** Shows a help interface.
- **PaladinAuraToggle:** Toggles the API on/off.

These macros will be visible to all, but won't allow players to mess with anything that affects others.

### Settings / Configuration

There are only two settings that can be configured (currently).

1. **active:** This setting toggles the API on or off.<br>**NOTE:** If the API is turned off while characters are receiving a Paladin bonus, the bonus will not be removed when their token moves away from the bonus-giving Paladin.

2. **diagonal_calc_override:** This setting overrides the roll20 map settings for diagonal calculations. It has five acceptable values:

- **none:** Do not override any settings / use the page's configuration. (**Default and Recommended**)
- **foure:** Use 4E / 5E D&D measuring.<br>(See image 1 of the reference below)
- **threefive:** Use 3E and below D&D measuring.<br>(See image 3 of the reference below)
- **pythagorean:** Use real life measuring.
- **manhattan:** Use straight line movement only, making diagonal movement count as 2 squares.<br>(See image 2 of the reference below)

![Diagonal Movement Reference](https://i.imgur.com/tZyn79Z.png)

### Feedback

[Submit an issue report or feature request.](https://github.com/LaytonGB/PaladinAura/issues/new/choose)
