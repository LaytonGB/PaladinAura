/* eslint-disable no-undef */
var StateVar;
(function (StateVar) {
    StateVar.active = "active";
    StateVar.diagOverride = "diagonal_calc_override";
})(StateVar || (StateVar = {}));
var PaladinAura = (function () {
    var stateName = "PaladinAura_";
    var states = [
        { name: StateVar.active },
        {
            name: StateVar.diagOverride,
            acceptables: ["none", "foure", "threefive", "pythagorean", "manhattan"],
            "default": "none"
        }
    ];
    var name = "Paladin Aura";
    var nameError = name + " ERROR";
    var nameLog = name + ": ";
    var apiCall = "!pa";
    var playerName, playerID, parts;
    var checkMacros = function () {
        var playerList = findObjs({ _type: "player", _online: true });
        var gm = playerList.find(function (player) {
            return playerIsGM(player.id) === true;
        });
        var macroArr = [
            {
                name: "PaladinAuraHelp",
                action: apiCall + " help"
            },
            {
                name: "PaladinAuraToggle",
                action: "" + apiCall
            },
            {
                name: "PaladinAuraConfig",
                action: apiCall + " config"
            }
        ];
        macroArr.forEach(function (macro) {
            var macroObj = findObjs({
                _type: "macro",
                name: macro.name
            })[0];
            if (macroObj) {
                if (macroObj.get("visibleto") !== "all") {
                    macroObj.set("visibleto", "all");
                    toChat("**Macro '" + macro.name + "' was made visible to all.**", true);
                }
                if (macroObj.get("action") !== macro.action) {
                    macroObj.set("action", macro.action);
                    toChat("**Macro '" + macro.name + "' was corrected.**", true);
                }
            }
            else if (gm && playerIsGM(gm.id)) {
                createObj("macro", {
                    _playerid: gm.id,
                    name: macro.name,
                    action: macro.action,
                    visibleto: "all"
                });
                toChat("**Macro '" + macro.name + "' was created and assigned to " + (gm.get("_displayname") + " ".split(" ", 1)[0]) + ".**", true);
            }
        });
    };
    var showHelp = function () {
        var commandsArr = [
            {
                name: apiCall + " help",
                desc: ["Lists all commands, their parameters, and their usage."]
            },
            {
                name: apiCall + " config",
                desc: ["Shows config and buttons that change settings."]
            },
            {
                name: "" + apiCall,
                desc: ["Toggles the Paladin Aura API on and off."],
                link: StateVar.active
            }
        ];
        commandsArr.forEach(function (command) {
            var output = "&{template:default} {{name=" + code(command.name) + "}}{{Function=";
            for (var i = 0; i < command.desc.length; i++) {
                if (i % 2 === 1) {
                    output += "{{=";
                }
                output += command.desc[i] + "}}";
            }
            if (command.link) {
                output += "{{Current Setting=" + getState(command.link) + "}}";
            }
            toChat(output, undefined, playerName);
        });
    };
    var showConfig = function () {
        var output = "&{template:default} {{name=" + name + " Config}}";
        states.forEach(function (s) {
            var acceptableValues = s.acceptables
                ? s.acceptables
                : ["true", "false"];
            var defaultValue = s.default ? s.default : "true";
            var currentValue = getState(s.name);
            var stringVals = valuesToString(acceptableValues, defaultValue);
            output += "{{" + s.name + "=[" + currentValue + "](" + apiCall + " config " + s.name + " ?{New " + s.name + " value" + stringVals + "})}}";
        });
        toChat(output, undefined, playerName);
        function valuesToString(values, defaultValue) {
            var output = "";
            var index = values.indexOf(defaultValue);
            if (index !== -1) {
                values.splice(index, 1);
                values.unshift(defaultValue);
            }
            values.forEach(function (v) {
                output += "|" + v;
            });
            return output;
        }
    };
    var setConfig = function (parts) {
        toChat("**" + parts[2] + "** has been changed **from " + state[stateName + "_" + parts[2]] + " to " + parts[3] + "**.", true, playerName);
        state[stateName + "_" + parts[2]] = parts[3];
        showConfig();
    };
    var handleInput = function (msg) {
        parts = msg.content.split(" ");
        if (msg.type === "api" && parts[0] === apiCall) {
            playerName = msg.who.split(" ", 1)[0];
            playerID = msg.playerid;
            if ([undefined, "config", "help"].includes(parts[1])) {
                if (parts[1] === "help") {
                    showHelp();
                }
                else if (playerIsGM(playerID)) {
                    if (!parts[1]) {
                        toggleActive();
                    }
                    else if (parts[1] === "config") {
                        if (parts[2]) {
                            setConfig(parts);
                        }
                        else {
                            showConfig();
                        }
                    }
                }
                else {
                    error("Command is only accessible to GMs.", 1);
                }
            }
            else {
                error("Command " + code(msg.content) + " not understood.", 0);
            }
        }
    };
    var toggleActive = function () {
        state[stateName + StateVar.active] = !getState(StateVar.active);
        toChat("**Paladin Aura " + (getState(StateVar.active) ? "Enabled" : "Disabled") + ".**", getState(StateVar.active));
    };
    var getState = function (value) {
        return state[stateName + value];
    };
    var code = function (snippet) {
        return ("<span style='background-color: rgba(0, 0, 0, 0.5); color: White; padding: 2px; border-radius: 3px;'>" +
            snippet +
            "</span>");
    };
    var toChat = function (message, success, target) {
        var whisper = target ? "/w " + target + " " : "";
        var style = "<div>";
        if (success === true) {
            style =
                "<br><div style='background-color: #5cd65c; color: Black; padding: 5px; border-radius: 10px;'>";
        }
        else if (success === false) {
            style =
                "<br><div style='background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;'>";
        }
        sendChat(name, whisper + style + message + "</div>");
    };
    var error = function (error, code) {
        if (playerName) {
            sendChat(nameError, "/w " + playerName + " <br><div style=\"background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;\">**" + error + "** Error code " + code + ".</div>");
        }
        else {
            sendChat(nameError, "<br><div style=\"background-color: #ff6666; color: Black; padding: 5px; border-radius: 10px;\">**" + error + "** Error code " + code + ".</div>");
        }
        log(nameLog + error + (" Error code " + code + "."));
    };
    var startupChecks = function () {
        states.forEach(function (s) {
            var acceptables = s.acceptables ? s.acceptables : ["true", "false"];
            var defaultVal = s.default ? s.default : "true";
            if (!state[stateName + s.name] ||
                !acceptables.includes(state[stateName + s.name])) {
                error("**'" +
                    s.name[0] +
                    "' value was '" +
                    state["stateName" + "s.name"] +
                    "' but has now been set to its default value, '" +
                    defaultVal +
                    "'.**", -1);
                state[stateName + s.name] = defaultVal;
            }
        });
    };
    var registerEventHandlers = function () {
        on("chat:message", handleInput);
        // on("change:graphic", paladinCheck);
    };
    return {
        CheckMacros: checkMacros,
        StartupChecks: startupChecks,
        RegisterEventHandlers: registerEventHandlers
    };
})();
on("ready", function () {
    PaladinAura.CheckMacros();
    PaladinAura.StartupChecks();
    PaladinAura.RegisterEventHandlers();
});
