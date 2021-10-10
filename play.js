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

function createRoomConfirm() {
	let roomName = document.getElementById("room-name").value;
	if(roomName == "") {
		Popup.ofTitleAndText("Error", "You need to input a room name").addButton("Okay").show();
		return;
	}

	document.getElementById("room-create-container").style.display = "none";
	document.getElementById("play-container").style.display = "block";

	storage.roomName = roomName;
	storage.roomSettings = {};
	storage.roomSettings.mode = document.getElementById("game-mode").value;
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

	eventLog.value = "";

	gameContainer.style.display = "none";

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

function displayError(message) {
	let txt = document.createElement("div");
	txt.classList.add("full", "message");
	txt.innerText = message;
	txt.style.zIndex = "1";
	document.body.appendChild(txt);
}

async function play() {
	try {
		await Network.init(VERBOSE);
	}catch(e) {
		displayError("Connection failed");
		console.log(e);
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
				roomSettings.setCommunistCardCount(11);
				roomSettings.setFascistCardCount(11);
				roomSettings.setLiberalCardCount(9);
			}else if(storage.roomSettings.mode == "SECRET_HITLER") {
				roomSettings.setCommunistCardCount(0);
				roomSettings.setFascistCardCount(11);
				roomSettings.setLiberalCardCount(6);
			}

			conPacket.setRoomSettings(roomSettings);
		}
	}

	storage = {};

	prepareCanvas();

	if(isMobile()) mobilePlayers(); // Toggle to player list by default on mobile

	Network.sendPacket(Packet.of(conPacket)).then(response => {
		if(PacketServerJoinError.isInstance(response.getData())) {
			displayError("Error: " + response.getData().getMessage());
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

		document.getElementById("btn-reset").remove();

		if(VERBOSE) console.log("Loading assets...");
		storage.assets = {
			cArticle: loadImage("article/communist.png"),
			fArticle: loadImage("article/fascist.png"),
			lArticle: loadImage("article/liberal.png"),
			articleBack: loadImage("article/back.png"),

			iconWin: {
				FASCIST: loadImage("icon/icon-win-f.png"),
				COMMUNIST: loadImage("icon/icon-win-c.png"),
				LIBERAL: null
			},

			iconPlayerBlocked: loadImage("icon/icon-player-blocked.png"),
			iconPreviousPresident: loadImage("icon/icon-player-previous-president.png"),
			iconPreviousChancellor: loadImage("icon/icon-player-previous-chancellor.png"),
			iconPresident: loadImage("icon/icon-president.png"),
			iconChancellor: loadImage("icon/icon-chancellor.png"),
			iconYes: loadImage("icon/icon-yes.png"),
			iconNo: loadImage("icon/icon-no.png"),
			iconDead: loadImage("icon/icon-dead.png"),
			iconNotHitler: loadImage("icon/icon-not-hitler.png"),
			iconNotStalin: loadImage("icon/icon-not-stalin.png"),
			iconConnection: loadImage("icon/connection.png"),

			iconRole: {
				LIBERAL: loadImage("icon/role-liberal.png"),
				STALIN: loadImage("icon/role-stalin.png"),
				COMMUNIST: loadImage("icon/role-communist.png"),
				HITLER: loadImage("icon/role-hitler.png"),
				FASCIST: loadImage("icon/role-fascist.png"),
			},

			actions: {
				KILL_PLAYER: {
					COMMUNIST: loadImage("icon/icon-kill-c.png"),
					FASCIST: loadImage("icon/icon-kill-f.png"),
				},
				INSPECT_PLAYER: {
					COMMUNIST: loadImage("icon/icon-inspect-c.png"),
					FASCIST: loadImage("icon/icon-inspect-f.png"),
				},
				BLOCK_PLAYER: {
					COMMUNIST: loadImage("icon/icon-block-c.png"),
					FASCIST: loadImage("icon/icon-block-f.png"),
				},
				EXAMINE_TOP_CARDS: {
					COMMUNIST: loadImage("icon/icon-top-cards-c.png"),
					FASCIST: loadImage("icon/icon-top-cards-f.png"),
				},
				EXAMINE_TOP_CARDS_OTHER: {
					COMMUNIST: loadImage("icon/icon-top-cards-other-c.png"),
					FASCIST: loadImage("icon/icon-top-cards-other-f.png"),
				},
				PICK_PRESIDENT: {
					COMMUNIST: loadImage("icon/icon-pick-president-c.png"),
					FASCIST: loadImage("icon/icon-pick-president-f.png"),
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

		setInterval(draw, REFRESH_TIME);
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
				Popup.ofTitleAndText("Game Over", "The " + packet.getData().getWinner().getFriendlyName() + " have won the game")
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
		canvasDiv.style.width = canvasContainer.clientWidth;
		canvasDiv.style.height = canvasContainer.clientWidth / aspectRatio;
		canvasDiv.style.top = 0;
		canvasDiv.style.left = 0;
		canvas.width = canvasContainer.clientWidth;
		canvas.height = canvasContainer.clientWidth / aspectRatio;

		let singleBoardHeight = canvas.height / numBoards;
		let docEl = document.documentElement;
		docEl.style.setProperty("--card-width", singleBoardHeight * 3 / 5 / 1.45 + "px");
		docEl.style.setProperty("--card-height", singleBoardHeight * 3 / 5 + "px");
		return;
	}

	let containerWidth = canvasContainer.clientWidth;
	let containerHeight = canvasContainer.clientHeight;

	canvas.style.position = "absolute";
	if(containerWidth / containerHeight > aspectRatio) {
		canvas.height = containerHeight;
		canvas.width = containerHeight * aspectRatio;

		canvasDiv.style.height = containerHeight;
		canvasDiv.style.width = containerHeight * aspectRatio;
		canvasDiv.style.left = (containerWidth - canvas.width) / 2;
		canvasDiv.style.top = 0;
	}else {
		canvas.width = containerWidth;
		canvas.height = containerWidth / aspectRatio;

		canvasDiv.style.width = containerWidth;
		canvasDiv.style.height = containerWidth / aspectRatio;
		canvasDiv.style.top = (containerHeight - canvas.height) / 2;
		canvasDiv.style.left = 0;
	}

	let singleBoardHeight = canvas.height / numBoards;
	let docEl = document.documentElement;
	docEl.style.setProperty("--card-width", singleBoardHeight * 3 / 5 / 1.45 + "px");
	docEl.style.setProperty("--card-height", singleBoardHeight * 3 / 5 + "px");
}

function draw() {
	prepareCanvas();

	let unitPixel = canvas.width / 1920;
	let cardWidth = unitPixel * 150;
	let cardHeight = cardWidth * 1.45;
	let cardSpacing = unitPixel * 20;

	let gameState = storage.room.getGameState();

	ctx.fillStyle = "lightgray";
	ctx.fillRect(0, 0, canvas.width, canvas.height);

	ctx.fillStyle = "black";
	ctx.font = "normal bold " + unitPixel * 30 + "px Germania One";
	ctx.textAlign = "left";
	ctx.textBaseline = "top";
	ctx.fillText("Room " + storage.roomID, unitPixel * 5, unitPixel * 5);

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
				if(isGamePaused()) return;
				for(let b of document.getElementsByClassName("player-button")) b.style.display = "none";

				action(player);
			};
		}
	}else {
		// Open popup to select player
		let popup = Popup.ofTitleAndText("Select Player", popupText);

		for(let player of storage.room.getPlayers()) {
			if(condition != null && !condition(player)) continue;
			popup.addButton(player.getName(), () => {
				if(isGamePaused()) return;
				action(player);
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
				if(isGamePaused()) return;

				let p = new PacketClientVote();
				p.setYes(true);
				Network.sendPacket(Packet.of(p));
				storage.selfVoted = true;
			})
			.addButton("Vote No", () => {
				if(isGamePaused()) return;

				let p = new PacketClientVote();
				p.setYes(false);
				Network.sendPacket(Packet.of(p));
				storage.selfVoted = true;
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
				if(isGamePaused()) return;

				let p = new PacketClientVeto();
				p.setAcceptVeto(true);
				Network.sendPacket(Packet.of(p));
			})
			.addButton("Decline Veto", () => {
				if(isGamePaused()) return;

				let p = new PacketClientVeto();
				p.setAcceptVeto(false);
				Network.sendPacket(Packet.of(p));
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
			if(isGamePaused()) return;

			Network.sendPacket(Packet.of(new PacketClientDrawCards()));
			cardPileDraw.style.visibility = "hidden";
		};
	}else {
		Popup.ofTitleAndText("Draw Cards", "You need to draw some cards")
			.addButton("Draw", () => {
				if(isGamePaused()) return;

				Network.sendPacket(Packet.of(new PacketClientDrawCards()));
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
				if(isGamePaused()) return;

				Network.sendPacket(Packet.of(new PacketClientDrawCards()));
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
			cardEl.src = "/assets/article/" + card.name().toLowerCase() + ".png";
			if(pickMode) cardEl.onclick = () => {
				let isSelected = selected.indexOf(i) != -1;
				if(isSelected) {
					Util.removeFromArray(selected, i);
					cardEl.src = "/assets/article/" + card.name().toLowerCase() + ".png";
				}else {
					selected.push(i);
					cardEl.src = "/assets/article/back.png";
				}
			};
			pickCardsCards.appendChild(cardEl);
		}

		pickCardsConfirm.onclick = () => {
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
				let p = new PacketClientVeto();
				Network.sendPacket(Packet.of(p));
			};

			pickCardsConfirm.onclick = null;
			pickCardsVeto.onclick = null;
			pickCards.style.display = "none";
		}else {
			pickCardsVeto.style.display = "none";
		}
	}else {
		let popup = Popup.ofTitleAndText("Pick Card", "Pick a card to dismiss")
			.addCardsView(cards, discardIndex => {
				if(pickMode) {
					let p = new PacketClientDiscardCard();
					p.setDiscardIndex(discardIndex);
					Network.sendPacket(Packet.of(p));
					if(action != null) action(discardIndex);
				}else {
					if(action != null) action();
				}
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