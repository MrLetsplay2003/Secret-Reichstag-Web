/* jshint esversion: 8 */

var REFRESH_TIME = 300;
var VERBOSE = true;

var canvasDiv = document.getElementById("canvas-div");
var gameContainer = document.getElementById("game-container");
var canvasContainer = document.getElementById("canvas-container");
var canvas = document.getElementById("main-canvas");
var eventLog = document.getElementById("event-log");
var chatIn = document.getElementById("chat-in");
var copyInvite = document.getElementById("copy-invite");
var cardPile = document.getElementById("card-pile");
var cardPileText = document.getElementById("card-pile-text");
var playerList = document.getElementById("player-list");
var roomIDDisplay = document.getElementById("room-id-display");
var playerRole = document.getElementById("player-role");
var voteButtons = document.getElementById("vote-buttons");
var vetoButtons = document.getElementById("veto-buttons");
var cardPileDraw = document.getElementById("card-pile-draw");
var pickCards = document.getElementById("pick-cards");
var pickCardsCards = document.getElementById("pick-cards-cards");
var pickCardsConfirm = document.getElementById("pick-cards-confirm");
var pickCardsVeto = document.getElementById("pick-cards-veto");
var playerListButton = document.getElementById("player-list-button");
var startGame = document.getElementById("start-game");
var drawIntervalID = -1;

var roomSettingsDefaults = {
	SECRET_HITLER: {
		"Secret Hitler: 5-6 players": {
			liberalActions: [],
			fascistActions: [
				null,
				null,
				"EXAMINE_TOP_CARDS",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			liberalCards: 6,
			fascistCards: 11
		},
		"Secret Hitler: 7-8 players": {
			liberalActions: [],
			fascistActions: [
				null,
				"INSPECT_PLAYER",
				"PICK_PRESIDENT",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			liberalCards: 6,
			fascistCards: 11
		},
		"Secret Hitler: 8-10 players": {
			liberalActions: [],
			fascistActions: [
				"INSPECT_PLAYER",
				"INSPECT_PLAYER",
				"PICK_PRESIDENT",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			liberalCards: 6,
			fascistCards: 11
		}
	},
	SECRET_REICHSTAG: {
		"Secret Reichstag: 7-8 players": {
			liberalActions: [],
			fascistActions: [
				null,
				"EXAMINE_TOP_CARDS",
				"BLOCK_PLAYER",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			communistActions: [
				null,
				"EXAMINE_TOP_CARDS_OTHER",
				"PICK_PRESIDENT",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			liberalCards: 9,
			fascistCards: 11,
			communistCards: 11
		},
		"Secret Reichstag: 9-14 players": {
			liberalActions: [],
			fascistActions: [
				"INSPECT_PLAYER",
				"PICK_PRESIDENT",
				"BLOCK_PLAYER",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			communistActions: [
				"INSPECT_PLAYER",
				"INSPECT_PLAYER",
				"EXAMINE_TOP_CARDS_OTHER",
				"KILL_PLAYER",
				"KILL_PLAYER"
			],
			liberalCards: 9,
			fascistCards: 11,
			communistCards: 11
		}
	}
};

var ctx = canvas.getContext("2d");

let storage = {};

chatIn.onkeyup = event => {
	if(event.key == "Enter" && event.target.value.trim() != "") {
		if(storage.selfID != null) {
			if(isPlayerDead(storage.selfID)) {
				Popup.ofTitleAndText("Error", "Chat is currently disabled because you are dead")
					.addButton("Okay")
					.show();
				return;
			}

			let p = new PacketClientChatMessage();
			p.setMessage(event.target.value);
			event.target.value = "";
			Network.sendPacket(Packet.of(p));
		}
	}
};

copyInvite.onclick = event => {
	if(storage.selfID != null) {
		if(navigator.clipboard != null) {
			let link = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + storage.room.getID();
			navigator.clipboard.writeText(link).then(() => {
				Popup.ofTitleAndText("Invite", "Copied invite link to clipboard")
					.addButton("Okay")
					.show();
			});
		}else {
			let c = document.createElement("input");
			c.value = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + storage.room.getID();
			document.body.appendChild(c);
			c.focus();
			c.select();
			document.execCommand('copy');
			c.remove();
			Popup.ofTitleAndText("Invite", "Copied invite link to clipboard")
				.addButton("Okay")
				.show();
		}
	}
};

function redirect(url) {
	window.open(url,'_blank');
}

resetPage();

function createRoom() {
	document.getElementById("room-container").style.display = "none";
	document.getElementById("room-create-container").style.display = "block";
	storage.createRoom = true;
	/*new Popup("Popup", "This is some popup text")
		.addButton("Okay")
		.addHideButton()
		.show();*/
}

function joinRoom() {
	document.getElementById("room-container").style.display = "none";
	document.getElementById("room-join-container").style.display = "block";
	storage.createRoom = false;
}

function rejoinRoom() {
	let sessID = localStorage.sessionID;
	if(sessID == null) {
		Popup.ofTitleAndText("Error", "No session available to rejoin").addButton("Okay").show();
		return;
	}

	document.getElementById("room-container").style.display = "none";
	document.getElementById("play-container").style.display = "none";
	storage.sessionID = sessID;
	play();
}

function joinRoomConfirm() {
	let roomID = document.getElementById("room-id").value;
	if(roomID == "") {
		Popup.ofTitleAndText("Error", "You need to input a room id").addButton("Okay").show();
		return;
	}

	document.getElementById("room-join-container").style.display = "none";
	document.getElementById("play-container").style.display = "block";

	storage.roomID = roomID;
}

async function createRoomAdvanced() {
	if(!applyRoomSettings(false)) return;

	let advContainer = document.getElementById("room-create-advanced-container");
	document.getElementById("room-create-container").style.display = "none";
	advContainer.style.display = "block";

	if(!window.GameBoardAction) {
		if(VERBOSE) console.log("Connecting to fetch classes");
		await Network.init();
		Network.disconnect();
	}

	loadAdvancedSettings();

	if(storage.roomSettings.mode != "SECRET_REICHSTAG") {
		for(let comm of advContainer.getElementsByClassName("communist-only")) comm.style.display = "none";
	}else {
		for(let comm of advContainer.getElementsByClassName("communist-only")) comm.style.display = "block";
	}
}

function loadAdvancedSettings() {
	loadActionSelects("liberal", 4);
	loadActionSelects("fascist", 5);
	loadActionSelects("communist", 5);
	loadCardCount("liberal");
	loadCardCount("fascist");
	loadCardCount("communist");
}

function loadCardCount(party) {
	if(!storage.roomSettings.advanced || !storage.roomSettings.advanced[party + "Cards"]) return;
	let input = document.getElementById(party + "-card-count");
	input.value = storage.roomSettings.advanced[party + "Cards"];
}

function loadActionSelects(party, count) {
	let container = document.getElementById(party + "-actions");
	while(container.firstChild) container.firstChild.remove();

	let customBox = document.createElement("div");
	customBox.classList.add("custom-box");

	let hasSettings = storage.roomSettings.advanced && storage.roomSettings.advanced[party + "Actions"];

	let useCustom = document.createElement("input");
	useCustom.type = "checkbox";
	useCustom.id = party + "-use-custom";
	useCustom.checked = hasSettings;
	useCustom.onchange = () => {
		for(let i = 0; i < count; i++)
			document.getElementById(party + "-action-" + i).disabled = !useCustom.checked;
	};
	customBox.appendChild(useCustom);

	let customText = document.createElement("label");
	customText.innerText = "Use custom board";
	customText.setAttribute("for", party + "-use-custom");
	customBox.append(customText);
	container.appendChild(customBox);

	for(let i = 0; i < count; i++) {
		let selOp = "none";
		if(hasSettings) {
			for(let ac of storage.roomSettings.advanced[party + "Actions"]) {
				if(ac.getFieldIndex() == i) {
					selOp = ac.getAction().name();
					break;
				}
			}
		}

		let sel = createActionSelect(party, i);
		sel.disabled = !hasSettings;
		sel.value = selOp;
		if(i > 0) container.appendChild(document.createElement("br"));
		container.appendChild(sel);
	}
}

function createActionSelect(party, idx) {
	let sel = document.createElement("select");
	let none = document.createElement("option");
	none.text = "No action";
	none.value = "none";
	sel.add(none);
	let i = 0;
	for(let gba of GameBoardAction.values()) {
		if(gba == GameBoardAction.WIN) continue; // Not a valid action to add to the board
		let op = document.createElement("option");
		op.text = gba.getFriendlyName();
		op.value = gba.name();
		sel.add(op);
		i++;
	}
	sel.id = party + "-action-" + idx;
	sel.classList.add("input", "menu-item");
	return sel;
}

function loadAdvancedDefaults() {
	let popup = Popup.ofTitleAndText("Load Defaults", "Choose which settings to load");
	let defs = roomSettingsDefaults[storage.roomSettings.mode];
	for(let k in defs) {
		popup.addButton(k, () => {
			storage.roomSettings.advanced = decodePreset(defs[k]);
			loadAdvancedSettings();
		});
	}
	popup.addButton("Cancel", null);
	popup.show();
}

function loadAdvancedPreset() {
	let presets = JSON.parse(localStorage.presets || "{}");
	let popup = Popup.ofTitleAndText("Load Preset", "Choose which settings to load");
	for(let k in presets) {
		popup.addButton(k, () => {
			storage.roomSettings.advanced = decodePreset(presets[k]);
			loadAdvancedSettings();
		});
	}
	popup.addButton("Cancel", null);
	popup.show();
}

function saveAdvancedPreset() {
	let popup = Popup.ofTitleAndText("Save Preset", "What do you want to save your preset as?");
	popup.addTextField("Name", "name", name => {
		let presets = JSON.parse(localStorage.presets || "{}");
		presets[name] = encodePreset(collectAdvancedSettings());
		localStorage.presets = JSON.stringify(presets);
	});
	popup.addButton("Cancel", null);
	popup.show();
}

function decodePreset(preset) {
	return {
		liberalActions: decodeActions(preset.liberalActions),
		fascistActions: decodeActions(preset.fascistActions),
		communistActions: decodeActions(preset.communistActions),
		liberalCards: preset.liberalCards,
		fascistCards: preset.fascistCards,
		communistCards: preset.communistCards
	}
}

function decodeActions(convActions) {
	if(convActions == null) return null;
	let actions = [];
	let i = 0;
	for(let a of convActions) {
		if(a != null) {
			let gba = new GameBoardActionField();
			gba.setFieldIndex(i);
			gba.setAction(GameBoardAction.valueOf(a));
			actions.push(gba);
		}
		i++;
	}
	return actions;
}

function encodePreset(preset) {
	return {
		liberalActions: encodeActions(preset.liberalActions),
		fascistActions: encodeActions(preset.fascistActions),
		communistActions: encodeActions(preset.communistActions),
		liberalCards: preset.liberalCards,
		fascistCards: preset.fascistCards,
		communistCards: preset.communistCards
	}
}

function encodeActions(convActions) {
	if(convActions == null) return null;
	let actions = [];
	for(let a of convActions) {
		actions[a.getFieldIndex()]  = a.getAction().name();
	}
	return actions;
}

function createRoomAdvancedConfirm() {
	storage.roomSettings.advanced = collectAdvancedSettings();
	document.getElementById("room-create-advanced-container").style.display = "none";
	document.getElementById("room-create-container").style.display = "block";
}

function collectAdvancedSettings() {
	let advanced = {};

	advanced.liberalActions = collectSelectedActions("liberal", 4);
	advanced.fascistActions = collectSelectedActions("fascist", 5);

	if(storage.roomSettings.mode == "SECRET_REICHSTAG") {
		advanced.communistActions = collectSelectedActions("communist", 5);
	}

	let lC = getCardCount("liberal");
	if(lC == -1) return;
	advanced.liberalCards = lC;

	let fC = getCardCount("fascist");
	if(fC == -1) return;
	advanced.fascistCards = fC;

	if(storage.roomSettings.mode == "SECRET_REICHSTAG") {
		let cC = getCardCount("communist");
		if(cC == -1) return;
		advanced.communistCards = cC;
	}

	return advanced;
}

function getCardCount(party) {
	let cardCount = document.getElementById(party + "-card-count").value;
	if(cardCount == "") {
		Popup.ofTitleAndText("Error", "Invalid " + party + " card count").addButton("Okay").show();
		return -1;
	}
	return parseInt(cardCount);
}

function collectSelectedActions(party, count) {
	if(!document.getElementById(party + "-use-custom").checked) return null;
	let actions = [];
	for(let i = 0; i < count; i++) {
		let a = getSelectedAction(party, i);
		if(a != null) actions.push(a);
	}
	return actions;
}

function getSelectedAction(party, i) {
	let v = document.getElementById(party + "-action-" + i).value;
	if(v == "none") return null;
	let field = new GameBoardActionField();
	field.setFieldIndex(i);
	field.setAction(GameBoardAction.valueOf(v));
	return field;
}

function createRoomConfirm() {
	if(!applyRoomSettings(true)) return;

	document.getElementById("room-create-container").style.display = "none";
	document.getElementById("play-container").style.display = "block";
}

function applyRoomSettings(strict) {
	let roomName = document.getElementById("room-name").value;
	if(strict && roomName == "") {
		Popup.ofTitleAndText("Error", "You need to input a room name").addButton("Okay").show();
		return false;
	}

	storage.roomName = roomName;
	if(!storage.roomSettings) storage.roomSettings = {};
	storage.roomSettings.mode = document.getElementById("game-mode").value;
	return true;
}

function nameConfirm() {
	let name = document.getElementById("username").value.trim();
	if(name == "") {
		Popup.ofTitleAndText("Error", "You need to input a username").addButton("Okay").show();
		return;
	}

	if(!(/^(?:[a-zA-Z0-9äöü]){1,20}$/.test(name))) {
		Popup.ofTitleAndText("Error", "Username contains invalid characters or is too long").addButton("Okay").show();
		return;
	}

	document.getElementById("play-container").style.display = "none";

	storage.username = name;

	play();
}

function resetPage() {
	for(let el of document.getElementsByClassName("full")) {
		el.style.display = "none";
	}

	for(let inp of document.getElementsByClassName("input")) {
		let def = inp.getAttribute("data-default");
		inp.value = def == null ? "" : def;
	}

	if(drawIntervalID != -1) clearInterval(drawIntervalID);

	storage = {};

	eventLog.value = "";

	gameContainer.style.display = "none";

	document.getElementById("room-id").onkeydown = event => {
		if(event.key == "Enter") joinRoomConfirm();
	};

	document.getElementById("room-name").onkeydown = event => {
		if(event.key == "Enter") createRoomConfirm();
	};

	document.getElementById("username").onkeydown = event => {
		if(event.key == "Enter") nameConfirm();
	};

	document.getElementById("play-container").style.display = "none";

	document.getElementById("room-container").style.display = "block";

	if(window.location.search != "" && window.location.search != "?") {
		let roomID = window.location.search.substr(1);
		if(!(/^\d{4,6}$/.test(roomID))) return;
		document.getElementById("room-id").value = roomID;
		joinRoom();
		joinRoomConfirm();
	}
}

async function play() {
	try {
		await Network.init(VERBOSE);
	}catch(e) {
		return;
	}

	let conPacket = new PacketClientConnect();

	if(storage.sessionID) {
		conPacket.setSessionID(storage.sessionID);
	}else {
		conPacket.setPlayerName(storage.username);
		conPacket.setCreateRoom(storage.createRoom);
		conPacket.setRoomID(storage.roomID);
		conPacket.setRoomName(storage.roomName);

		if(storage.roomSettings) {
			let roomSettings = new RoomSettings();
			roomSettings.setMode(storage.roomSettings.mode);

			if(storage.roomSettings.mode == "SECRET_REICHSTAG") {
				roomSettings.setLiberalCardCount(9);
				roomSettings.setFascistCardCount(11);
				roomSettings.setCommunistCardCount(11);
			}else if(storage.roomSettings.mode == "SECRET_HITLER") {
				roomSettings.setLiberalCardCount(6);
				roomSettings.setFascistCardCount(11);
				roomSettings.setCommunistCardCount(0);
			}

			let advanced = storage.roomSettings.advanced;
			if(advanced) {
				if(advanced.liberalCards) roomSettings.setLiberalCardCount(advanced.liberalCards);
				if(advanced.fascistCards) roomSettings.setFascistCardCount(advanced.fascistCards);
				if(storage.roomSettings.mode == "SECRET_REICHSTAG" && advanced.communistCards) roomSettings.setLiberalCardCount(advanced.communistCards);

				if(advanced.liberalActions) {
					roomSettings.setLiberalBoard(advanced.liberalActions);
				}
	
				if(advanced.fascistActions) {
					roomSettings.setFascistBoard(advanced.fascistActions);
				}

				if(storage.roomSettings.mode == "SECRET_REICHSTAG" && advanced.communistActions) {
					roomSettings.setCommunistBoard(advanced.communistActions);
				}
			}

			conPacket.setRoomSettings(roomSettings);
		}
	}

	storage = {};

	prepareCanvas();

	if(isMobile()) mobilePlayers(); // Toggle to player list by default on mobile

	Network.sendPacket(Packet.of(conPacket)).then(response => {
		if(PacketServerJoinError.isInstance(response.getData())) {
			Popup.ofTitleAndText("Error", response.getData().getMessage()).addButton("Okay", () => resetPage()).show();
			return;
		}

		gameContainer.style.display = null; // Use CSS display

		let room = response.getData().getRoom();
		let selfPlayer = response.getData().getSelfPlayer();
		let sessionID = response.getData().getSessionID();

		if(response.getData().isVoteDone()) storage.selfVoted = true;

		localStorage.sessionID = sessionID;

		storage.room = room;
		storage.selfPlayer = selfPlayer;
		storage.roomID = room.getID();
		storage.selfID = selfPlayer.getID();
		storage.hand = {
			cards: [],
			selected: []
		}

		roomIDDisplay.innerText = "Room #" + room.getID();

		if(VERBOSE) console.log("Loading assets...");
		storage.assets = {
			cArticle: loadImage("article/communist.svg"),
			fArticle: loadImage("article/fascist.svg"),
			lArticle: loadImage("article/liberal.svg"),
			articleBack: loadImage("article/back.svg"),

			iconWin: {
				FASCIST: loadImage("action/win-f.svg"),
				COMMUNIST: loadImage("action/win-c.svg"),
				LIBERAL: loadImage("action/win-l.svg"),
			},

			iconPlayerBlocked: loadImage("player/blocked.svg"),
			iconPreviousPresident: loadImage("player/previous-president.svg"),
			iconPreviousChancellor: loadImage("player/previous-chancellor.svg"),
			iconPresident: loadImage("player/president.svg"),
			iconChancellor: loadImage("player/chancellor.svg"),
			iconYes: loadImage("player/vote-yes.svg"),
			iconNo: loadImage("player/vote-no.svg"),
			iconDead: loadImage("player/dead.svg"),
			iconNotHitler: loadImage("player/not-hitler.svg"),
			iconNotStalin: loadImage("player/not-stalin.svg"),
			iconConnection: loadImage("player/connection.svg"),

			iconRole: {
				LIBERAL: loadImage("player/role-liberal.svg"),
				STALIN: loadImage("player/role-stalin.svg"),
				COMMUNIST: loadImage("player/role-communist.svg"),
				HITLER: loadImage("player/role-hitler.svg"),
				FASCIST: loadImage("player/role-fascist.svg"),
			},

			actions: {
				KILL_PLAYER: {
					COMMUNIST: loadImage("action/kill-c.svg"),
					FASCIST: loadImage("action/kill-f.svg"),
					LIBERAL: loadImage("action/kill-l.svg"),
				},
				INSPECT_PLAYER: {
					COMMUNIST: loadImage("action/inspect-c.svg"),
					FASCIST: loadImage("action/inspect-f.svg"),
					LIBERAL: loadImage("action/inspect-l.svg"),
				},
				BLOCK_PLAYER: {
					COMMUNIST: loadImage("action/block-c.svg"),
					FASCIST: loadImage("action/block-f.svg"),
					LIBERAL: loadImage("action/block-l.svg"),
				},
				EXAMINE_TOP_CARDS: {
					COMMUNIST: loadImage("action/top-cards-c.svg"),
					FASCIST: loadImage("action/top-cards-f.svg"),
					LIBERAL: loadImage("action/top-cards-l.svg"),
				},
				EXAMINE_TOP_CARDS_OTHER: {
					COMMUNIST: loadImage("action/top-cards-other-c.svg"),
					FASCIST: loadImage("action/top-cards-other-f.svg"),
					LIBERAL: loadImage("action/top-cards-other-l.svg"),
				},
				PICK_PRESIDENT: {
					COMMUNIST: loadImage("action/pick-president-c.svg"),
					FASCIST: loadImage("action/pick-president-f.svg"),
					LIBERAL: loadImage("action/pick-president-l.svg"),
				}
			}

		}

		storage.assets.article = {
			COMMUNIST: storage.assets.cArticle,
			FASCIST: storage.assets.fArticle,
			LIBERAL: storage.assets.lArticle,
		}

		storage.colors = {
			teammate: {
				COMMUNIST: "darkred",
				FASCIST: "#a35c2f"
			},
			leader: {
				COMMUNIST: "#660000",
				FASCIST: "#693b1e"
			},
			role: {
				LIBERAL: "#004e6e",
				COMMUNIST: "darkred",
				FASCIST: "#a35c2f",
				HITLER: "#693b1e",
				STALIN: "#660000"
			},
			board: {
				background: "#363835",
				infoText: "#ffa200",
				COMMUNIST: {
					outerFill: "darkred",
					unsafeFill: "#660000",
					cardBackground: "#c25439",
					title: "#bf0003"
				},
				FASCIST: {
					outerFill: "#a35c2f",
					unsafeFill: "#693b1e",
					cardBackground: "#7d4624",
					title: "#693b1e"
				},
				LIBERAL: {
					outerFill: "#61c8d9",
					cardBackground: "#004e6e",
					title: "#004e6e",
					electionTrackerActive: "#FFFF00",
					electionTrackerInactive: "#FFFFFF"
				}
			}
		}

		updatePlayerList();
		updateCardPile();

		drawIntervalID = setInterval(draw, REFRESH_TIME);
		window.onresize = draw;
	
		if(VERBOSE) console.log("Done!");
	});

	Network.setPacketListener(packet => {
		if(VERBOSE) console.log("received", packet);

		if(PacketServerPlayerJoined.isInstance(packet.getData())) {
			if(packet.getData().isRejoin()) {
				for(let i = 0; i < storage.room.getPlayers().length; i++) {
					let pl = storage.room.getPlayers()[i];
					if(packet.getData().getPlayer().getID() == pl.getID()) {
						pl.online = true;
						break;
					}
				}
			}else {
				storage.room.getPlayers().push(packet.getData().getPlayer());
				updatePlayerList();
			}

			createStartButtonIfNeeded();
		}

		if(PacketServerPlayerLeft.isInstance(packet.getData())) {

			for(let i = 0; i < storage.room.getPlayers().length; i++) {
				let pl = storage.room.getPlayers()[i];
				if(packet.getData().getPlayer().getID() == pl.getID()) {
					if(packet.getData().isHardLeave()) {
						storage.room.getPlayers().splice(i, 1);
					}else {
						pl.online = false;
					}
					updatePlayerList();
					break;
				}
			}

			if(storage.room.getPlayers().length < storage.room.getMode().getMinPlayers()) removeStartButton();
		}

		if(PacketServerPauseGame.isInstance(packet.getData())) {
			storage.room.setGamePaused(true);
		}

		if(PacketServerUnpauseGame.isInstance(packet.getData())) {
			storage.room.setGamePaused(false);
		}


		if(PacketServerStopGame.isInstance(packet.getData())) {
			storage.selfRole = null;
			storage.partyPopup = null;
			storage.room.setGameRunning(false);

			playerRole.innerText = "Waiting";
			playerRole.style.color = "white";

			playerListButton.style.display = "none";

			for(let p of storage.room.getPlayers()) {
				p.isTeammate = null;
				p.isLeader = null;
				p.vote = null;
				p.wasRole = packet.getData().roles[p.getID()];
			}

			if(packet.getData().getWinner() != null) {
				Popup.ofTitleAndText("Game Over", "The " + packet.getData().getWinner().getFriendlyName() + " have won the game",["win-" + packet.getData().getWinner().getFriendlyName().toLowerCase()])
					.addButton("GG", () => createStartButtonIfNeeded())
					.show();
			}
		}

		if(PacketServerStartGame.isInstance(packet.getData())) {
			let d = packet.getData();

			storage.selfRole = d.getRole();
			storage.room.setGameRunning(true);

			playerRole.innerText = d.getRole().name();
			playerRole.style.color = storage.colors.role[storage.selfRole.name()];

			if(d.getTeammates() != null) {
				for(let t of d.getTeammates()) {
					for(let p of storage.room.getPlayers()) {
						if(p.getID() != t.getID()) continue;
						p.isTeammate = true;
						break;
					}
				}
			}

			for(let p of storage.room.getPlayers()) {
				p.wasRole = null;
			}
			
			if(d.getLeader() != null) {
				for(let p of storage.room.getPlayers()) {
					if(p.getID() != d.getLeader().getID()) continue;
					p.isLeader = true;
					break;
				}
			}

			updatePlayerList();
		}

		if(PacketServerEventLogEntry.isInstance(packet.getData())) {
			let d = packet.getData();
			eventLog.value += (d.isChatMessage() ? "" : "- ") + d.getMessage() + "\n";

			eventLog.scrollTop = eventLog.scrollHeight;
		}

		if(PacketServerUpdateGameState.isInstance(packet.getData())) {
			if(storage.room == null) return; // We're most likely not connected yet

			let s = packet.getData().getNewState();
			storage.room.setGameState(s);
			updatePlayerList();
			updateCardPile();

			if(s.getMoveState() != GameMoveState.VOTE) storage.selfVoted = null;

			if(s.getMoveState() == GameMoveState.DRAW_CARDS && s.getPresident().getID() == storage.selfID) {
				promptDrawCards();
			}else if(s.getMoveState() == GameMoveState.SELECT_CHANCELLOR && s.getPresident().getID() == storage.selfID) {
				showPlayerSelect("Select a player to be the next chancellor", "Select", player => {
					if(player.getID() == storage.selfID) return false;
					if(s.getPreviousPresident() != null && player.getID() == s.getPreviousPresident().getID()) return false;
					if(s.getPreviousChancellor() != null && player.getID() == s.getPreviousChancellor().getID()) return false;
					if(s.getBlockedPlayer() != null && player.getID() == s.getBlockedPlayer().getID()) return false;
					if(isPlayerDead(player.getID())) return false;
					return true;
				}, player => {
					let p = new PacketClientSelectChancellor();
					p.setPlayerID(player.getID());
					Network.sendPacket(Packet.of(p));
				});
			}else if(s.getMoveState() == GameMoveState.VOTE) {
				if(isPlayerDead(storage.selfID) || storage.selfVoted) return;
				promptVote();
			}
		}

		if(PacketServerVoteResults.isInstance(packet.getData())) {
			for(let pID in packet.getData().getVotes()) {
				let isYes = packet.getData().getVotes()[pID];
				let pl;
				for(let p of storage.room.getPlayers()) {
					if(p.getID() == pID) {
						pl = p;
						break;
					}
				}
				if(pl == null) continue;
				pl.vote = isYes;
			}

			storage.selfVoted = null;

			updatePlayerList();
			showVoteDismiss();
		}

		if(PacketServerPlayerAction.isInstance(packet.getData())) {
			let d = packet.getData();
			switch(d.getAction()) {
				case GameBoardAction.EXAMINE_TOP_CARDS:
				{
					promptInspectCards(d.getData().getCards());
					break;
				}
				case GameBoardAction.EXAMINE_TOP_CARDS_OTHER:
				{
					showPlayerSelect("Select a player to examine the top three cards", "Select", player => {
						if(player.getID() == storage.selfID) return false;
						if(isPlayerDead(player.getID())) return false;
						return true;
					}, player => {
						let p = new PacketClientPerformAction();
						let a = new ActionExamineTopCardsOther();

						a.setPlayerID(player.getID());
						p.setData(a);

						Network.sendPacket(Packet.of(p));
					});
					break;
				}
				case GameBoardAction.KILL_PLAYER:
				{
					showPlayerSelect("Select a player to kill", "Kill", player => {
						if(player.getID() == storage.selfID) return false;
						if(isPlayerDead(player.getID())) return false;
						return true;
					}, player => {
						let p = new PacketClientPerformAction();
						let a = new ActionKillPlayer();

						a.setPlayerID(player.getID());
						p.setData(a);

						Network.sendPacket(Packet.of(p));
					});
					break;
				}
				case GameBoardAction.PICK_PRESIDENT:
				{
					showPlayerSelect("Select a player to be the next president", "Select", player => {
						if(player.getID() == storage.selfID) return false;
						if(isPlayerDead(player.getID())) return false;
						return true;
					}, player => {
						let p = new PacketClientPerformAction();
						let a = new ActionPickPresident();

						a.setPlayerID(player.getID());
						p.setData(a);

						Network.sendPacket(Packet.of(p));
					});
					break;
				}
				case GameBoardAction.INSPECT_PLAYER:
				{
					showPlayerSelect("Select a player to inspect", "Inspect", player => {
						if(player.getID() == storage.selfID) return false;
						if(isPlayerDead(player.getID())) return false;
						return true;
					}, player => {
						let p = new PacketClientPerformAction();
						let a = new ActionInspectPlayer();

						a.setPlayerID(player.getID());
						p.setData(a);
						Network.sendPacket(Packet.of(p)).then(response => {
							Popup.ofTitleAndText("Inspect Player", player.getName() + "'s role is: " + response.getData().getParty().getFriendlyNameSingular())
								.addButton("Okay")
								.show();
						});
					});
					break;
				}
				case GameBoardAction.BLOCK_PLAYER:
				{
					let s = storage.room.getGameState();
					showPlayerSelect("Select a player to block", "Block", player => {
						if(player.getID() == storage.selfID) return false;
						if(isPlayerDead(player.getID())) return false;
						if(player.getID() == s.getChancellor().getID()) return false;
						if(player.getID() == s.getPresident().getID() && storage.room.getPlayers().length >= 8) return false;
						return true;
					}, player => {
						let p = new PacketClientPerformAction();
						let a = new ActionBlockPlayer();

						a.setPlayerID(player.getID());
						p.setData(a);

						Network.sendPacket(Packet.of(p));
					});
					break;
				}
			}
		}

		if(PacketServerPickCards.isInstance(packet.getData())) {
			let s = storage.room.getGameState();
            let vetoButton = !packet.getData().isVetoBlocked() && s.getChancellor().getID() == storage.selfID && s.isVetoPowerUnlocked();
			showCardsView(packet.getData().getCards(), true, vetoButton);
		}

		if(PacketServerVeto.isInstance(packet.getData())) {
			promptVeto();
		}
	});
}

function createStartButtonIfNeeded() {
	let mode = storage.room.getMode();
	if(storage.room.getPlayers().length >= mode.getMinPlayers()) {
		if(storage.room.isGameRunning()) return;
		if(storage.room.getPlayers()[0].getID() != storage.selfID) return;

		startGame.style.display = "block";
	}
}

function startGameFunction() {
	Network.sendPacket(Packet.of(new PacketClientStartGame()));
	removeStartButton();
}

function removeStartButton() {
	startGame.style.display = "none";
}

function prepareCanvas() {
	if(storage.room == null) return;

	// Size + Position the canvas to always have the correct aspect ratio
	let numBoards = storage.room.getMode() == GameMode.SECRET_HITLER ? 2 : 3;
	let aspectRatio = 3 / numBoards;

	if(isMobile()) {
		canvasDiv.style.width = (canvasContainer.clientWidth) + "px";
		canvasDiv.style.height = (canvasContainer.clientWidth / aspectRatio) + "px";
		canvasDiv.style.top = 0;
		canvasDiv.style.left = 0;
		canvas.width = canvasContainer.clientWidth;
		canvas.height = canvasContainer.clientWidth / aspectRatio;

		let singleBoardHeight = canvas.height / numBoards;
		let docEl = document.documentElement;
		docEl.style.setProperty("--card-width", (singleBoardHeight * 3 / 5 / 1.45) + "px");
		docEl.style.setProperty("--card-height", (singleBoardHeight * 3 / 5) + "px");
		return;
	}

	let containerWidth = canvasContainer.clientWidth;
	let containerHeight = canvasContainer.clientHeight;

	canvas.style.position = "absolute";
	if(containerWidth / containerHeight > aspectRatio) {
		canvas.height = containerHeight;
		canvas.width = containerHeight * aspectRatio;

		canvasDiv.style.height = containerHeight + "px";
		canvasDiv.style.width = (containerHeight * aspectRatio) + "px";
		canvasDiv.style.left = ((containerWidth - canvas.width) / 2) + "px";
		canvasDiv.style.top = 0;
	}else {
		canvas.width = containerWidth;
		canvas.height = containerWidth / aspectRatio;

		canvasDiv.style.width = containerWidth + "px";
		canvasDiv.style.height = (containerWidth / aspectRatio) + "px";
		canvasDiv.style.top = ((containerHeight - canvas.height) / 2) + "px";
		canvasDiv.style.left = 0;
	}

	let singleBoardHeight = canvas.height / numBoards;
	let docEl = document.documentElement;
	docEl.style.setProperty("--card-width", singleBoardHeight * 3 / 5 / 1.45 + "px");
	docEl.style.setProperty("--card-height", singleBoardHeight * 3 / 5 + "px");
}

function draw() {
	prepareCanvas();

	ctx.fillStyle = "lightgray";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	let mode = storage.room.getMode();
	let boardHeight = storage.room.getMode() == GameMode.SECRET_HITLER ? canvas.height / 2 : canvas.height / 3;

	// Liberal track
	drawBoard(ctx, GameParty.LIBERAL, 0, 0, canvas.width, boardHeight);

	// Communist track
	if(mode == GameMode.SECRET_REICHSTAG) drawBoard(ctx, GameParty.COMMUNIST, 0, canvas.height * 1 / 3, canvas.width, boardHeight);

	// Fascist track
	let fascistBoardOffset = mode == GameMode.SECRET_REICHSTAG ? 0 : -boardHeight;
	drawBoard(ctx, GameParty.FASCIST, 0, fascistBoardOffset + 2 * boardHeight, canvas.width, boardHeight);
}

function updateCardPile() {
	cardPileText.innerText = storage.room.getGameState().getDrawPileSize();
}

function updatePlayerList() {
	let oldChildren = new Array(...playerList.children);
	for(let player of storage.room.getPlayers()) {
		let oldEl = document.getElementById("player-" + player.getID());
		let oldButton = oldEl != null ? oldEl.getElementsByClassName("player-button")[0] : null;

		let playerEl = document.createElement("div");
		playerEl.classList.add("player-list-element");
		playerEl.id = "player-" + player.getID();

		let playerUpper = document.createElement("div");
		playerUpper.classList.add("player-upper");
		playerEl.appendChild(playerUpper);

		let nameEl = document.createElement("a");
		nameEl.classList.add("player-name");
		nameEl.innerText = player.getName();
		playerUpper.appendChild(nameEl);

		let s = storage.room.getGameState();
		let isDead = isPlayerDead(player.getID());

		nameEl.style.textDecoration = isDead ? "line-through" : "none";

		if(player.getID() == storage.selfID) {
			nameEl.style.color = "green";
		}else if(storage.selfRole) {
			let partyName = storage.selfRole.getParty().name();

			let pColor = "white";

			if(player.isLeader) {
				pColor = storage.colors.leader[partyName];
			}

			if(player.isTeammate) {
				pColor = storage.colors.teammate[partyName];
			}

			nameEl.style.color = pColor;
		}else {
			nameEl.style.color = "white";
		}

		if(oldButton != null) {
			playerUpper.appendChild(oldButton);
		}else {
			let playerBtn = document.createElement("button");
			playerBtn.classList.add("player-button");
			playerBtn.classList.add("fancy-button");
			playerBtn.innerText = "?";
			playerBtn.style.display = "none";
			playerUpper.append(playerBtn);
		}

		let icons = document.createElement("div");
		icons.classList.add("player-icons");
		playerEl.appendChild(icons);

		if(!player.online) {
			addIcon(icons, storage.assets.iconConnection);
		}
	
		if(s.getPresident() != null && s.getPresident().getID() == player.getID()) {
			addIcon(icons, storage.assets.iconPresident);
		}
	
		if(s.getChancellor() != null && s.getChancellor().getID() == player.getID()) {
			addIcon(icons, storage.assets.iconChancellor);
		}
	
		if(s.getPreviousPresident() != null && s.getPreviousPresident().getID() == player.getID()) {
			addIcon(icons, storage.assets.iconPreviousPresident);
		}
	
		if(s.getPreviousChancellor() != null && s.getPreviousChancellor().getID() == player.getID()) {
			addIcon(icons, storage.assets.iconPreviousChancellor);
		}
	
		if(s.getBlockedPlayer() != null && s.getBlockedPlayer().getID() == player.getID()) {
			addIcon(icons, storage.assets.iconPlayerBlocked);
		}
	
		if(isDead) {
			addIcon(icons, storage.assets.iconDead);
		}
	
		if(isPlayerNotHitlerConfirmed(player.getID())) {
			addIcon(icons, storage.assets.iconNotHitler);
		}
	
		if(isPlayerNotStalinConfirmed(player.getID())) {
			addIcon(icons, storage.assets.iconNotStalin);
		}
	
		if(player.vote != null) {
			addIcon(icons, player.vote ? storage.assets.iconYes : storage.assets.iconNo);
		}
	
		if(player.wasRole != null) {
			addIcon(icons, storage.assets.iconRole[player.wasRole.name()]);
		}

		playerList.appendChild(playerEl);
	}

	for(let c of oldChildren) {
		c.remove();
	}
}

function addIcon(playerEl, icon) {
	let iconEl = icon.cloneNode();
	iconEl.classList.add("player-icon");
	playerEl.appendChild(iconEl);
}

function loadImage(assetName) {
	let img = new Image();
	img.src = "assets/" + assetName;
	return img;
}

function getPlayer(playerID) {
	for(let p of storage.room.getPlayers()) {
		if(p.getID() == playerID) return p;
	}
	return null;
}

function isPlayerDead(playerID) {
	if(storage.room.getGameState() == null) return false;
	for(let p of storage.room.getGameState().getDeadPlayers()) {
		if(p.getID() == playerID) return true;
	}
	return false;
}

function isPlayerNotHitlerConfirmed(playerID) {
	for(let p of storage.room.getGameState().getNotHitlerConfirmed()) {
		if(p.getID() == playerID) return true;
	}
	return false;
}

function isPlayerNotStalinConfirmed(playerID) {
	for(let p of storage.room.getGameState().getNotStalinConfirmed()) {
		if(p.getID() == playerID) return true;
	}
	return false;
}

function isGamePaused() {
	return storage.room.isGamePaused();
}

function mobileHideAll() {
	document.getElementById("player-list").style.display = "none";
	document.getElementById("mobile-chat").style.display = "none";
	document.getElementById("mobile-menu").style.display = "none";
}

function mobilePlayers() {
	mobileHideAll();
	document.getElementById("player-list").style.display = null;
}

function mobileChat() {
	mobileHideAll();
	document.getElementById("mobile-chat").style.display = null;
}

function mobileMenu() {
	mobileHideAll();
	document.getElementById("mobile-menu").style.display = null;
}

function isMobile() {
	return window.matchMedia("only screen and (max-width: 46.875em)").matches;
}

function showPlayerSelect(popupText, buttonText, condition, action) {
	if(!isMobile()) {
		// Show buttons in player list
		for(let player of storage.room.getPlayers()) {
			if(condition != null && !condition(player)) continue;
			let playerEl = document.getElementById("player-" + player.getID());
			let playerBtn = playerEl.getElementsByClassName("player-button")[0];
			playerBtn.innerText = buttonText;
			playerBtn.style.display = null; // Use default CSS display
			playerBtn.onclick = () => {
				if(isGamePaused()) return false;
				for(let b of document.getElementsByClassName("player-button")) b.style.display = "none";

				action(player);
				return true;
			};
		}
	}else {
		// Open popup to select player
		let popup = Popup.ofTitleAndText("Select Player", popupText);

		for(let player of storage.room.getPlayers()) {
			if(condition != null && !condition(player)) continue;
			popup.addButton(player.getName(), () => {
				if(isGamePaused()) return false;

				action(player);
				return true;
			});
		}

		popup.addHideButton();
		popup.show();
	}
}

function promptVote() {
	if(!isMobile()) {
		// Show buttons at the bottom
		voteButtons.style.display = "flex";
	}else {
		let s = storage.room.getGameState();
		Popup.ofTitleAndText("Vote", s.getPresident().getName() + " proposes " + s.getChancellor().getName() + " to be the next chancellor")
			.addButton("Vote Yes", () => {
				if(isGamePaused()) return false;

				let p = new PacketClientVote();
				p.setYes(true);
				Network.sendPacket(Packet.of(p));
				storage.selfVoted = true;
				return true;
			})
			.addButton("Vote No", () => {
				if(isGamePaused()) return false;

				let p = new PacketClientVote();
				p.setYes(false);
				Network.sendPacket(Packet.of(p));
				storage.selfVoted = true;
				return true;
			})
			.addHideButton()
			.show();
	}
}

function voteButton(vote) {
	if(isGamePaused()) return;

	let p = new PacketClientVote();
	p.setYes(vote);
	Network.sendPacket(Packet.of(p));
	storage.selfVoted = true;
	voteButtons.style.display = "none";
}

function promptVeto() {
	if(!isMobile()) {
		// Show buttons at the bottom
		vetoButtons.style.display = "flex";
	}else {
		let s = storage.room.getGameState();
		Popup.ofTitleAndText("Veto", s.getChancellor().getName() + " requested a veto")
			.addButton("Accept Veto", () => {
				if(isGamePaused()) return false;

				let p = new PacketClientVeto();
				p.setAcceptVeto(true);
				Network.sendPacket(Packet.of(p));
				return true;
			})
			.addButton("Decline Veto", () => {
				if(isGamePaused()) return false;

				let p = new PacketClientVeto();
				p.setAcceptVeto(false);
				Network.sendPacket(Packet.of(p));
				return true;
			})
			.addHideButton()
			.show();
	}
}

function vetoButton(veto) {
	if(isGamePaused()) return;

	let p = new PacketClientVeto();
	p.setAcceptVeto(veto);
	Network.sendPacket(Packet.of(p));
	vetoButtons.style.display = "none";
}

function promptDrawCards() {
	if(!isMobile()) {
		// Show "Draw" button below card pile
		cardPileDraw.style.visibility = "unset";
		cardPileDraw.innerText = "Draw";
		cardPileDraw.onclick = () => {
			if(isGamePaused()) return false;

			Network.sendPacket(Packet.of(new PacketClientDrawCards()));
			cardPileDraw.style.visibility = "hidden";
			return true;
		};
	}else {
		Popup.ofTitleAndText("Draw Cards", "You need to draw some cards")
			.addButton("Draw", () => {
				if(isGamePaused()) return false;

				Network.sendPacket(Packet.of(new PacketClientDrawCards()));
				return true;
			})
			.addHideButton()
			.show();
	}
}

function promptInspectCards(cards) {
	if(!isMobile()) {
		// Show "Inspect" button below card pile
		cardPileDraw.style.visibility = "unset";
		cardPileDraw.innerText = "Inspect";
		cardPileDraw.onclick = () => {
			if(isGamePaused()) return;

			showCardsView(cards, false, false, () => {
				let p = new PacketClientPerformAction();
				Network.sendPacket(Packet.of(p));
			});
			cardPileDraw.style.visibility = "hidden";
		};
	}else {
		Popup.ofTitleAndText("Inspect Cards", "You need to inspect the top three cards")
			.addButton("Inspect", () => {
				if(isGamePaused()) return false;

				let p = new PacketClientPerformAction();
				Network.sendPacket(Packet.of(p));
				return true;
			})
			.addHideButton()
			.show();
	}
}

function showCardsView(cards, pickMode, vetoButton, action) {
	if(!isMobile()) {
		// Show card picker at the bottom of the screen
		pickCards.style.display = "block";

		while(pickCardsCards.firstChild) pickCardsCards.firstChild.remove();

		let selected = [];
		for(let i = 0; i < cards.length; i++) {
			let card = cards[i];
			let cardEl = document.createElement("img");
			cardEl.src = "/assets/article/" + card.name().toLowerCase() + ".svg";
			if(pickMode) cardEl.onclick = () => {
				let isSelected = selected.indexOf(i) != -1;
				if(isSelected) {
					Util.removeFromArray(selected, i);
					cardEl.src = "/assets/article/" + card.name().toLowerCase() + ".svg";
				}else {
					selected.push(i);
					cardEl.src = "/assets/article/back.svg";
				}
			};
			pickCardsCards.appendChild(cardEl);
		}

		pickCardsConfirm.onclick = () => {
			if(isGamePaused()) return;

			if(pickMode) {
				if(selected.length != 1) {
					Popup.ofTitleAndText("Error", "You need to select exactly 1 card to dismiss")
						.addButton("Okay")
						.show();
					return;
				}

				let p = new PacketClientDiscardCard();
				p.setDiscardIndex(selected[0]);
				Network.sendPacket(Packet.of(p));
				if(action != null) action(selected[0]);
			}else {
				if(action != null) action();
			}

			pickCardsConfirm.onclick = null;
			pickCardsVeto.onclick = null;
			pickCards.style.display = "none";
		};

		if(vetoButton) {
			pickCardsVeto.style.display = null;
			pickCardsVeto.onclick = () => {
				if(isGamePaused()) return;

				let p = new PacketClientVeto();
				Network.sendPacket(Packet.of(p));

				pickCardsConfirm.onclick = null;
				pickCardsVeto.onclick = null;
				pickCards.style.display = "none";
			};
		}else {
			pickCardsVeto.style.display = "none";
		}
	}else {
		let popup = Popup.ofTitleAndText("Pick Card", "Pick a card to dismiss")
			.addCardsView(cards, discardIndex => {
				if(isGamePaused()) return false;

				if(pickMode) {
					let p = new PacketClientDiscardCard();
					p.setDiscardIndex(discardIndex);
					Network.sendPacket(Packet.of(p));
					if(action != null) action(discardIndex);
				}else {
					if(action != null) action();
				}

				return true;
			}, pickMode);
		if(vetoButton) popup.addButton("Veto", () => {
			let p = new PacketClientVeto();
			Network.sendPacket(Packet.of(p));
		});
		popup.addHideButton();
		popup.show();
	}
}

function showVoteDismiss() {
	if(isMobile()) return;
	playerListButton.innerText = "Dismiss Votes";
	playerListButton.style.display = "block";
	playerListButton.onclick = () => {
		for(let p of storage.room.getPlayers()) {
			p.vote = null;
		}
		playerListButton.style.display = "none";
		playerListButton.onclick = null;
		updatePlayerList();
	};
}