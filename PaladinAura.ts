/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
import * as _ from "underscore";
import * as T from "./types";

const PaladinAura = (() => {
  const stateName = "PaladinAura";
  const states: T.State[] = [
    { name: "active" },
    {
      name: "diagonal_calc_override",
      acceptables: ["none", "foure", "threefive", "pythagorean", "manhattan"],
      default: "none"
    }
  ];
  const name = "Paladin Aura";
  const nameError = name + " ERROR";
  const nameLog = name + ": ";
  const apiCall = "!pa";

  let playerName: string, playerID: string;

  const checkMacros = () => {
    const playerList = findObjs({ _type: "player", _online: true });
    const gm = _.find(playerList, player => {
      return playerIsGM(player.id) === true;
    });
    const macroArr: T.Macro[] = [
      {
        name: "PaladinAuraHelp",
        action: `${apiCall} help`
      }
    ];
  };

  return {
    CheckMacros: checkMacros,
    StartupChecks: startupChecks,
    RegisterEventHandlers: registerEventHandlers
  };
})();

on("ready", () => {
  PaladinAura.CheckMacros();
  PaladinAura.StartupChecks();
  PaladinAura.RegisterEventHandlers();
});
