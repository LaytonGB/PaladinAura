/* eslint-disable no-undef */

interface StateForm {
  name: State;
  acceptables?: string[];
  default?: string;
  ignore?: boolean;
}

interface MacroForm {
  name: string;
  action: string;
  visibleto?: string;
}

interface HelpForm {
  name: string;
  desc: string[];
  example?: string[];
  link?: State;
}

enum State {
  active = "active",
  diagOverride = "diagonal_calc_override"
}

const PaladinAura = (() => {
  const stateName = "PaladinAura_";
  const states: StateForm[] = [
    { name: State.active },
    {
      name: State.diagOverride,
      acceptables: ["none", "foure", "threefive", "pythagorean", "manhattan"],
      default: "none"
    }
  ];
  const name = "Paladin Aura";
  const nameError = name + " ERROR";
  const nameLog = name + ": ";
  const apiCall = "!pa";

  let playerName: string, playerID: string, parts: string[];

  const checkMacros = () => {
    const playerList = findObjs({ _type: "player", _online: true });
    const gm = playerList.find(player => {
      return playerIsGM(player.id) === true;
    }) as Player;
    const macroArr: MacroForm[] = [
      {
        name: "PaladinAuraHelp",
        action: `${apiCall} help`
      },
      {
        name: "PaladinAuraToggle",
        action: `${apiCall}`
      },
      {
        name: "PaladinAuraConfig",
        action: `${apiCall} config`
      }
    ];
    macroArr.forEach(macro => {
      const macroObj = findObjs({
        _type: "macro",
        name: macro.name
      })[0] as Macro;
      if (macroObj) {
        if (macroObj.get("visibleto") !== "all") {
          macroObj.set("visibleto", "all");
          toChat(`**Macro '${macro.name}' was made visible to all.**`, true);
        }
        if (macroObj.get("action") !== macro.action) {
          macroObj.set("action", macro.action);
          toChat(`**Macro '${macro.name}' was corrected.**`, true);
        }
      } else if (gm && playerIsGM(gm.id)) {
        createObj("macro", {
          _playerid: gm.id,
          name: macro.name,
          action: macro.action,
          visibleto: "all"
        });
        toChat(
          `**Macro '${macro.name}' was created and assigned to ${gm.get(
            "_displayname"
          )}.**`,
          true
        );
      }
    });
  };

  const showHelp = () => {
    const commandsArr: HelpForm[] = [
      {
        name: `${apiCall} help`,
        desc: ["Lists all commands, their parameters, and their usage."]
      },
      {
        name: `${apiCall} config`,
        desc: ["Shows config and buttons that change settings."]
      },
      {
        name: `${apiCall}`,
        desc: ["Toggles the Paladin Aura API on and off."],
        link: State.active
      }
    ];
    commandsArr.forEach(command => {
      let output =
        "&{template:default} {{name=" + code(command.name) + "}}{{Function=";
      for (let i = 0; i < command.desc.length; i++) {
        if (i % 2 === 1) {
          output += "{{=";
        }
        output += command.desc[i] + "}}";
      }
      if (command.link) {
        output += "{{Current Setting=" + getState(command.link) + "}}";
      }
      toChat(output, undefined, playerID);
    });
  };

  const showConfig = () => {
    let output = `&{template:default} {{name=${name} Config}}`;
    states.forEach(s => {
      const acceptableValues = s.acceptables
        ? s.acceptables
        : ["true", "false"];
      const defaultValue = s.default ? s.default : "true";
      const currentValue = getState(s.name);
      const stringVals = valuesToString(acceptableValues, defaultValue);
      output += `{{${s.name}=[${currentValue}](${apiCall} config ${s.name} ?{New ${s.name} value${stringVals}})}}`;
    });
    toChat(output, undefined, playerID);

    function valuesToString(values: string[], defaultValue: string) {
      let output = "";
      const index = values.indexOf(defaultValue);
      if (index !== -1) {
        values.splice(index, 1);
        values.unshift(defaultValue);
      }
      values.forEach(v => {
        output += "|" + v;
      });
      return output;
    }
  };

  const setConfig = (parts: string[]) => {
    toChat(
      `**${parts[2]}** has been changed **from ${
        state[`${stateName}_${parts[2]}`]
      } to ${parts[3]}**.`,
      true,
      playerID
    );
    state[`${stateName}_${parts[2]}`] = parts[3];
    showConfig();
  };

  const handleInput = (msg: ChatEventData) => {
    parts = msg.content.split(" ");
    if (msg.type === "api" && parts[0] === apiCall) {
      playerName = msg.who.split(" ", 1)[0];
      playerID = msg.playerid;
      if (["", "config", "help"].includes(parts[1])) {
        if (parts[1] === "help") {
          showHelp();
        } else if (playerIsGM(playerID)) {
          if (!parts[1]) {
            toggleActive();
          } else if (parts[1] === "config") {
            if (parts[2]) {
              setConfig(parts);
            } else {
              showConfig();
            }
          }
        } else {
          error("Command is only accessible to GMs.", 1);
        }
      } else {
        error("Command " + code(msg.content) + " not understood.", 0);
      }
    }
  };

  const toggleActive = () => {
    state[stateName + State.active] = !getState(State.active);
    toChat(
      `**Paladin Aura ${getState(State.active) ? "Enabled" : "Disabled"}.**`,
      getState(State.active)
    );
  };

  const getState = (value: State) => {
    return state[stateName + value];
  };

  const code = (snippet: string) => {
    return (
      "<span style='background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;'>" +
      snippet +
      "</span>"
    );
  };

  const toChat = (
    message: string,
    success?: boolean,
    target?: string
  ): void => {
    const whisper = target ? "/w " + target + " " : "";
    let style = "<div>";
    if (success === true) {
      style =
        "<br><div style='background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;'>";
    } else if (success === false) {
      style =
        "<br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>";
    }
    sendChat(name, whisper + style + message + "</div>");
  };

  const error = (error: string, code: number) => {
    if (playerName) {
      sendChat(
        nameError,
        `/w ${playerName} <br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">**${error}** Error code ${code}.</div>`
      );
    } else {
      sendChat(
        nameError,
        `<br><div style="background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;">**${error}** Error code ${code}.</div>`
      );
    }
    log(nameLog + error + ` Error code ${code}.`);
  };

  const startupChecks = () => {
    states.forEach(s => {
      const acceptables = s.acceptables ? s.acceptables : ["true", "false"];
      const defaultVal = s.default ? s.default : "true";
      if (
        !state[stateName + s.name] ||
        !acceptables.includes(state[stateName + s.name])
      ) {
        error(
          "**'" +
            s.name[0] +
            "' value was '" +
            state["stateName" + "s.name"] +
            "' but has now been set to its default value, '" +
            defaultVal +
            "'.**",
          -1
        );
        state[stateName + s.name] = defaultVal;
      }
    });
  };

  const registerEventHandlers = () => {
    on("chat:message", handleInput);
    // on("change:graphic", paladinCheck);
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
