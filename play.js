/* jshint esversion: 8 */

var REFRESH_TIME = 300;
var VERBOSE = true;

var canvasDiv = document.getElementById("canvas-div");
var canvas = document.getElementById("main-canvas");
var eventLog = document.getElementById("event-log");
var chatIn = document.getElementById("chat-in");
var copyInvite = document.getElementById("copy-invite");

var ctx = canvas.getContext("2d");

let storage = {};

chatIn.onkeyup = event => {
    if(event.key == "Enter" && event.target.value.trim() != "") {
        if(storage.selfID != null) {
            if(isPlayerDead(storage.selfID)) {
                alert("Chat is currently disabled because you are dead");
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
        let c = document.createElement("input");
        c.value = window.location.protocol + "//" + window.location.host + window.location.pathname + "?" + storage.room.getID();
        document.body.appendChild(c);
        c.focus();
        c.select();
        document.execCommand('copy');
        c.remove();
        alert("Copied invite link to clipboard");
    }
};

resetPage();

function createRoom() {
    document.getElementById("room-container").style.display = "none";
    document.getElementById("room-create-container").style.display = "block";
    storage.createRoom = true;
}

function joinRoom() {
    document.getElementById("room-container").style.display = "none";
    document.getElementById("room-join-container").style.display = "block";
    storage.createRoom = false;
}

function joinRoomConfirm() {
    let roomID = document.getElementById("room-id").value;
    if(roomID == "") {
        alert("You need to input a room id");
        return;
    }

    document.getElementById("room-join-container").style.display = "none";
    document.getElementById("play-container").style.display = "block";

    storage.roomID = roomID;
}

function createRoomConfirm() {
    let roomName = document.getElementById("room-name").value;
    if(roomName == "") {
        alert("You need to input a room name");
        return;
    }

    let playerCount = document.getElementById("player-count").value;
    if(playerCount == "") {
        alert("You need to input a player count");
        return;
    }

    document.getElementById("room-create-container").style.display = "none";
    document.getElementById("play-container").style.display = "block";

    storage.roomName = roomName;
    storage.roomSettings = {};
    storage.roomSettings.playerCount = parseInt(playerCount);
}

function nameConfirm() {
    let name = document.getElementById("username").value.trim();
    if(name == "") {
        alert("You need to input a username");
        return;
    }

    if(!(/^(?:[a-zA-Z0-9äöü]){1,20}$/.test(name))) {
        alert("Username contains invalid characters");
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

    canvasDiv.style.display = "none";

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
    conPacket.setPlayerName(storage.username);
    conPacket.setCreateRoom(storage.createRoom);
    conPacket.setRoomID(storage.roomID);
    conPacket.setRoomName(storage.roomName);

    if(storage.roomSettings) {
        let roomSettings = new RoomSettings();
        roomSettings.setPlayerCount(storage.roomSettings.playerCount);

        conPacket.setRoomSettings(roomSettings);
    }

    storage = {};

    prepareCanvas();

    Network.sendPacket(Packet.of(conPacket)).then(response => {
        if(PacketServerJoinError.isInstance(response.getData())) {
            displayError("Error: " + response.getData().getMessage());
            return;
        }

        canvasDiv.style.display = "block";

        let room = response.getData().getRoom();
        let selfPlayer = response.getData().getSelfPlayer();

        storage.room = room;
        storage.selfPlayer = selfPlayer;
        storage.roomID = room.getID();
        storage.selfID = selfPlayer.getID();
        storage.hand = {
            cards: [],
            selected: []
        }

        document.getElementById("btn-reset").remove();

        if(VERBOSE) console.log("Loading assets...");
        storage.assets = {
            cArticle: loadImage("article/communist.png"),
            fArticle: loadImage("article/fascist.png"),
            lArticle: loadImage("article/liberal.png"),
            articleBack: loadImage("article/back.png"),

            iconWin: {
                FASCIST: loadImage("icon/icon-win-f.png"),
                COMMUNIST: loadImage("icon/icon-win-c.png")
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
                }
            }
        }
    
        setInterval(draw, REFRESH_TIME);
    
        if(VERBOSE) console.log("Done!");
    });

    Network.setPacketListener(packet => {
        if(VERBOSE) console.log("received", packet);

        if(PacketServerPlayerJoined.isInstance(packet.getData())) {
            storage.room.getPlayers().push(packet.getData().getPlayer());

            createStartButtonIfNeeded();
        }

        if(PacketServerPlayerLeft.isInstance(packet.getData())) {
            for(let i = 0; i < storage.room.getPlayers().length; i++) {
                if(packet.getData().getPlayer().getID() == storage.room.getPlayers()[i].getID()) {
                    storage.room.getPlayers().splice(i, 1);
                    break;
                }
            }

            removeStartButton();
        }


        if(PacketServerStopGame.isInstance(packet.getData())) {
            storage.selfRole = null;
            storage.partyPopup = null;

            for(let p of storage.room.getPlayers()) {
                p.isTeammate = null;
                p.isLeader = null;
                p.vote = null;
            }

            clearClickables();
            clearHoverables();

            if(packet.getData().getWinner() != null) {
                let unitPixel = canvas.width / 1920;

                storage.winner = packet.getData().getWinner();

                createButton("Dismiss", canvas.width / 2 - unitPixel * 200, canvas.height / 2 + unitPixel * 100, unitPixel * 400, unitPixel * 50, b => {
                    storage.winner = null;
                    b.remove();
                    createStartButtonIfNeeded();
                });
            }
        }

        if(PacketServerStartGame.isInstance(packet.getData())) {
            let d = packet.getData();

            storage.selfRole = d.getRole();
            
            if(d.getTeammates() != null) {
                for(let t of d.getTeammates()) {
                    for(let p of storage.room.getPlayers()) {
                        if(p.getID() != t.getID()) continue;
                        p.isTeammate = true;
                        break;
                    }
                }
            }
            
            if(d.getLeader() != null) {
                for(let p of storage.room.getPlayers()) {
                    if(p.getID() != d.getLeader().getID()) continue;
                    p.isLeader = true;
                    break;
                }
            }
        }

        if(PacketServerEventLogEntry.isInstance(packet.getData())) {
            let d = packet.getData();
            eventLog.value += (d.isChatMessage() ? "" : "- ") + d.getMessage() + "\n";

            eventLog.scrollTop = eventLog.scrollHeight;
        }

        if(PacketServerUpdateGameState.isInstance(packet.getData())) {
            let s = packet.getData().getNewState();
            storage.room.setGameState(s);

            if(s.getMoveState() == GameMoveState.DRAW_CARDS && s.getPresident().getID() == storage.selfID) {
                let unitPixel = canvas.width / 1920;
                let cardWidth = unitPixel * 150;
                let cardHeight = cardWidth * 1.45;

                let drawPileX = canvas.width / 5 - unitPixel * 20 - cardWidth;
                let drawPileY = canvas.height / 2 - cardHeight / 2;
                
                createButton("Draw", drawPileX, drawPileY + cardHeight + unitPixel * 20, cardWidth, unitPixel * 40, btn => {
                    Network.sendPacket(Packet.of(new PacketClientDrawCards()));
                    btn.remove();
                });
            }else if(s.getMoveState() == GameMoveState.SELECT_CHANCELLOR && s.getPresident().getID() == storage.selfID) {
                let unitPixel = canvas.width / 1920;
                let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
                let playerListY = unitPixel * 50;
                let playerListWidth = canvas.width / 5 - unitPixel * 20;

                let buttons = [];
                for(let i = 0; i < storage.room.getPlayers().length; i++) {
                    let player = storage.room.getPlayers()[i];

                    if(player.getID() == storage.selfID) continue;

                    let s = storage.room.getGameState();
                    if(s.getPreviousPresident() != null && player.getID() == s.getPreviousPresident().getID()) continue;
                    if(s.getPreviousChancellor() != null && player.getID() == s.getPreviousChancellor().getID()) continue;
                    if(s.getBlockedPlayer() != null && player.getID() == s.getBlockedPlayer().getID()) continue;
                    if(isPlayerDead(player.getID())) continue;

                    buttons.push(createButton("Select", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
                        for(let b of buttons) b.remove();
                        
                        let p = new PacketClientSelectChancellor();
                        p.setPlayerID(player.getID());
                        Network.sendPacket(Packet.of(p));
                    }));
                }
            }else if(s.getMoveState() == GameMoveState.VOTE) {
                if(isPlayerDead(storage.selfID)) return;

                let unitPixel = canvas.width / 1920;
                let buttons = [];

                buttons.push(createButton("Vote Yes", canvas.width / 2 - unitPixel * 205, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
                    for(let b of buttons) b.remove();

                    let p = new PacketClientVote();
                    p.setYes(true);
                    Network.sendPacket(Packet.of(p));
                }));

                buttons.push(createButton("Vote No", canvas.width / 2 + unitPixel * 5, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
                    for(let b of buttons) b.remove();

                    let p = new PacketClientVote();
                    p.setYes(false);
                    Network.sendPacket(Packet.of(p));
                }));
            }
        }

        if(PacketServerVoteResults.isInstance(packet.getData())) {
            let unitPixel = canvas.width / 1920;
            let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
            let playerListY = unitPixel * 50;
            let playerListWidth = canvas.width / 5 - unitPixel * 20;
            let playerListHeight = unitPixel * 60 * 14; // 14 players max

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

            for(let btn of document.getElementsByClassName("dismiss-vote-results")) btn.remove();

            let bt = createButton("Dismiss vote results", playerListX, playerListY + playerListHeight, playerListWidth, unitPixel * 50, b => {
                b.remove();

                for(let p of storage.room.getPlayers()) {
                    p.vote = null;
                }
            });

            bt.classList.add("dismiss-vote-results");
        }

        if(PacketServerPlayerAction.isInstance(packet.getData())) {
            let d = packet.getData();
            switch(d.getAction()) {
                case GameBoardAction.EXAMINE_TOP_CARDS:
                {
                    let unitPixel = canvas.width / 1920;
                    let cardWidth = unitPixel * 150;
                    let cardHeight = cardWidth * 1.45;

                    let drawPileX = canvas.width / 5 - unitPixel * 20 - cardWidth;
                    let drawPileY = canvas.height / 2 - cardHeight / 2;
                    
                    createButton("Inspect", drawPileX, drawPileY + cardHeight + unitPixel * 20, cardWidth, unitPixel * 40, btn => {
                        storage.hand.cards = d.getData().getCards();
                        btn.remove();

                        createButton("Confirm", canvas.width / 2 - unitPixel * 100, canvas.height - cardHeight - unitPixel * 50, unitPixel * 200, unitPixel * 50, btn2 => {
                            btn2.remove();
                            storage.hand.cards = [];

                            let p = new PacketClientPerformAction();
                            Network.sendPacket(Packet.of(p));
                        });
                    });

                    break;
                }
                case GameBoardAction.EXAMINE_TOP_CARDS_OTHER:
                {
                    let unitPixel = canvas.width / 1920;
                    let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
                    let playerListY = unitPixel * 50;
                    let playerListWidth = canvas.width / 5 - unitPixel * 20;
    
                    let buttons = [];
                    for(let i = 0; i < storage.room.getPlayers().length; i++) {
                        let player = storage.room.getPlayers()[i];
    
                        if(player.getID() == storage.selfID) continue;
                        if(isPlayerDead(player.getID())) continue;
    
                        buttons.push(createButton("Select", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
                            for(let b of buttons) b.remove();

                            let p = new PacketClientPerformAction();
                            let a = new ActionExamineTopCardsOther();

                            a.setPlayerID(player.getID());
                            p.setData(a);
                            
                            Network.sendPacket(Packet.of(p));
                        }));
                    }
                    break;
                }
                case GameBoardAction.KILL_PLAYER:
                {
                    let unitPixel = canvas.width / 1920;
                    let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
                    let playerListY = unitPixel * 50;
                    let playerListWidth = canvas.width / 5 - unitPixel * 20;
    
                    let buttons = [];
                    for(let i = 0; i < storage.room.getPlayers().length; i++) {
                        let player = storage.room.getPlayers()[i];
    
                        if(player.getID() == storage.selfID) continue;
                        if(isPlayerDead(player.getID())) continue;
    
                        buttons.push(createButton("Kill", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
                            for(let b of buttons) b.remove();

                            let p = new PacketClientPerformAction();
                            let a = new ActionKillPlayer();

                            a.setPlayerID(player.getID());
                            p.setData(a);
                            
                            Network.sendPacket(Packet.of(p));
                        }));
                    }
                    break;
                }
                case GameBoardAction.PICK_PRESIDENT:
                {
                    let unitPixel = canvas.width / 1920;
                    let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
                    let playerListY = unitPixel * 50;
                    let playerListWidth = canvas.width / 5 - unitPixel * 20;
    
                    let buttons = [];
                    for(let i = 0; i < storage.room.getPlayers().length; i++) {
                        let player = storage.room.getPlayers()[i];
    
                        if(player.getID() == storage.selfID) continue;
                        if(isPlayerDead(player.getID())) continue;
    
                        buttons.push(createButton("Select", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
                            for(let b of buttons) b.remove();

                            let p = new PacketClientPerformAction();
                            let a = new ActionPickPresident();

                            a.setPlayerID(player.getID());
                            p.setData(a);
                            
                            Network.sendPacket(Packet.of(p));
                        }));
                    }
                    break;
                }
                case GameBoardAction.INSPECT_PLAYER:
                {
                    let unitPixel = canvas.width / 1920;
                    let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
                    let playerListY = unitPixel * 50;
                    let playerListWidth = canvas.width / 5 - unitPixel * 20;
    
                    let buttons = [];
                    for(let i = 0; i < storage.room.getPlayers().length; i++) {
                        let player = storage.room.getPlayers()[i];
    
                        if(player.getID() == storage.selfID) continue;
                        if(isPlayerDead(player.getID())) continue;
    
                        buttons.push(createButton("Inspect", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
                            for(let b of buttons) b.remove();

                            let p = new PacketClientPerformAction();
                            let a = new ActionInspectPlayer();

                            a.setPlayerID(player.getID());
                            p.setData(a);
                            
                            Network.sendPacket(Packet.of(p)).then(response => {
                                let party = response.getData().getParty();
                                storage.partyPopup = {player: player, party: party};

                                createButton("Dismiss", canvas.width / 2 - unitPixel * 200, canvas.height / 2 + unitPixel * 100, unitPixel * 400, unitPixel * 50, b => {
                                    storage.partyPopup = null;
                                    b.remove();
                                });
                            });
                        }));
                    }
                    break;
                }
                case GameBoardAction.BLOCK_PLAYER:
                {
                    let unitPixel = canvas.width / 1920;
                    let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
                    let playerListY = unitPixel * 50;
                    let playerListWidth = canvas.width / 5 - unitPixel * 20;
    
                    let buttons = [];
                    for(let i = 0; i < storage.room.getPlayers().length; i++) {
                        let player = storage.room.getPlayers()[i];

                        let s = storage.room.getGameState();

                        if(player.getID() == storage.selfID) continue;
                        if(isPlayerDead(player.getID())) continue;
                        if(player.getID() == s.getChancellor().getID()) continue;
                        if(player.getID() == s.getPresident().getID() && storage.room.getPlayers().length >= 8) continue;

                        buttons.push(createButton("Block", playerListX + playerListWidth / 3 * 2 + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 5, playerListWidth / 3 - unitPixel * 20, unitPixel * 50, () => {
                            for(let b of buttons) b.remove();

                            let p = new PacketClientPerformAction();
                            let a = new ActionBlockPlayer();

                            a.setPlayerID(player.getID());
                            p.setData(a);
                            
                            Network.sendPacket(Packet.of(p));
                        }));
                    }
                    break;
                }
            }
        }

        if(PacketServerPickCards.isInstance(packet.getData())) {
            storage.hand.cards = packet.getData().getCards();
            let unitPixel = canvas.width / 1920;
            let cardWidth = unitPixel * 150;
            let cardHeight = cardWidth * 1.45;

            let cardSpacingH = unitPixel * 10;
            let x = canvas.width / 2 - storage.hand.cards.length * (cardWidth + cardSpacingH) / 2;

            let areas = [];
            for(let i = 0; i < storage.hand.cards.length; i++) {
                areas.push(createClickableArea(x + i * (cardWidth + cardSpacingH) + cardSpacingH / 2, canvas.height - cardHeight + cardSpacingH / 2, cardWidth, cardHeight, () => {
                    if(storage.hand.selected.indexOf(i) != -1) {
                        removeFromArray(storage.hand.selected, i);
                    }else {
                        storage.hand.selected.push(i);
                    }
                }, "Card #" + (i + 1)));
            }

            let s = storage.room.getGameState();
            let vetoButton = !packet.getData().isVetoBlocked() && s.getChancellor().getID() == storage.selfID && s.isVetoPowerUnlocked();
            let buttons = [];

            buttons.push(createButton("Confirm", canvas.width / 2 - unitPixel * (vetoButton ? 200 : 100), canvas.height - cardHeight - unitPixel * 50, unitPixel * 200, unitPixel * 50, () => {
                if(storage.hand.selected.length != 1) {
                    alert("Select exactly 1 card to be discarded");
                    return;
                }

                for(let btn of buttons) btn.remove();
                for(let area of areas) area.remove();

                let discardIndex = storage.hand.selected[0];

                storage.hand.cards = [];
                storage.hand.selected = [];

                let p = new PacketClientDiscardCard();
                p.setDiscardIndex(discardIndex);
                Network.sendPacket(Packet.of(p));
            }));

            if(vetoButton) {
                buttons.push(createButton("Veto", canvas.width / 2, canvas.height - cardHeight - unitPixel * 50, unitPixel * 200, unitPixel * 50, () => {
                    for(let btn of buttons) btn.remove();
                    for(let area of areas) area.remove();

                    storage.hand.cards = [];
                    storage.hand.selected = [];

                    let p = new PacketClientVeto();
                    Network.sendPacket(Packet.of(p));
                }));
            }
        }

        if(PacketServerVeto.isInstance(packet.getData())) {
            let unitPixel = canvas.width / 1920;
            let buttons = [];

            buttons.push(createButton("Accept Veto", canvas.width / 2 - unitPixel * 205, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
                for(let b of buttons) b.remove();

                let p = new PacketClientVeto();
                p.setAcceptVeto(true);
                Network.sendPacket(Packet.of(p));
            }));

            buttons.push(createButton("Decline Veto", canvas.width / 2 + unitPixel * 5, canvas.height - unitPixel * 100, unitPixel * 200, unitPixel * 100, () => {
                for(let b of buttons) b.remove();

                let p = new PacketClientVeto();
                p.setAcceptVeto(false);
                Network.sendPacket(Packet.of(p));
            }));
        }
    });
}

function createStartButtonIfNeeded() {
    if(storage.room.getPlayers().length >= storage.room.getSettings().getPlayerCount()) {
        if(storage.room.getPlayers()[0].getID() != storage.selfID) return;
        let unitPixel = canvas.width / 1920;
        let b = createButton("Start Game", canvas.width / 2 - unitPixel * 200, canvas.height / 2 - unitPixel * 100, unitPixel * 400, unitPixel * 200, button => {
            button.remove();
            
            Network.sendPacket(Packet.of(new PacketClientStartGame()));
        });
        b.classList.add("start-button");
    }
}

function removeStartButton() {
    for(let b of document.getElementsByClassName("start-button")) b.remove();
}

function prepareCanvas() {
    // Size + Position the canvas to always have a 16:9 aspect ratio
    canvas.style.position = "absolute";
    if(9 * window.innerWidth > 16 * window.innerHeight) {
        canvas.height = window.innerHeight;
        canvas.width = window.innerHeight / 9 * 16;
        //canvas.style.left = (window.innerWidth - canvas.width) / 2;
        //canvas.style.top = 0;

        canvasDiv.style.height = window.innerHeight;
        canvasDiv.style.width = window.innerHeight / 9 * 16;
        canvasDiv.style.left = (window.innerWidth - canvas.width) / 2;
        canvasDiv.style.top = 0;
    }else {
        canvas.width = window.innerWidth;
        canvas.height = window.innerWidth / 16 * 9;
        //canvas.style.top = (window.innerHeight - canvas.height) / 2;
        //canvas.style.left = 0;

        canvasDiv.style.width = window.innerWidth;
        canvasDiv.style.height = window.innerWidth / 16 * 9;
        canvasDiv.style.top = (window.innerHeight - canvas.height) / 2;
        canvasDiv.style.left = 0;
    }
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

    // Liberal track
    ctx.fillStyle = "#363835";
    ctx.fillRect(canvas.width / 5, 0, canvas.width * 3 / 5, canvas.height / 3);

    ctx.fillStyle = "#61c8d9";
    ctx.fillRect(canvas.width / 5 + unitPixel * 10, unitPixel * 10, canvas.width * 3 / 5 - unitPixel * 20, canvas.height / 3 - unitPixel * 15);

    for(let i = 0; i < 4; i++) {
        let circleArea = canvas.width / 5.5;
        let x = canvas.width / 2 - circleArea / 2 + circleArea / 3 * i;
        ctx.fillStyle = storage.room.getGameState().getFailedElections() == i ? "yellow" : "white";
        ctx.beginPath();
        ctx.arc(x, canvas.height / 3 - (canvas.height / 3 - unitPixel * 85 - cardHeight) / 2, unitPixel * 20, 0, 2 * Math.PI);
        ctx.fill();
    }

    let libBoard = gameState.getLiberalBoard();

    for(let cardIdx = 0; cardIdx < 5; cardIdx++) {
        ctx.fillStyle = "#004e6e";

        let spaceLeftRight = (canvas.width * 3 / 5 - 5 * (cardSpacing + cardWidth)) / 2;

        let cardOffsetX = canvas.width / 5 + spaceLeftRight;

        ctx.fillRect(cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2, unitPixel * 85, cardWidth, cardHeight);

        if(libBoard.getNumCards() > cardIdx) {
            drawImageWithBounds(storage.assets.lArticle, cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2, unitPixel * 85, cardWidth, cardHeight);
        }
    }

    ctx.fillStyle = "#004e6e";
    ctx.font = "normal bold " + unitPixel * 40 + "px Germania One";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Liberal", canvas.width / 5 + canvas.width * 3 / 5 / 2, unitPixel * 50);

    // Communist track

    drawBoard(GameParty.COMMUNIST, canvas.height / 3, gameState.getCommunistBoard(), false);

    // Fascist track

    drawBoard(GameParty.FASCIST, canvas.height * 2 / 3, gameState.getFascistBoard(), true);

    // Draw pile
    
    let drawPileX = canvas.width / 5 - unitPixel * 20 - cardWidth;
    let drawPileY = canvas.height / 2 - cardHeight / 2;

    ctx.fillStyle = "gray";
    for(let i = Math.min(gameState.getDrawPileSize() - 1, 2); i >= 0; i--) {
        ctx.fillRect(drawPileX + unitPixel * 4 * i, drawPileY + unitPixel * 4 * i, cardWidth + unitPixel * 1, cardHeight + unitPixel * 1);
        drawImageWithBounds(storage.assets.articleBack, drawPileX + unitPixel * 4 * i, drawPileY + unitPixel * 4 * i, cardWidth, cardHeight);
    }

    ctx.fillStyle = "white";
    ctx.font = "normal bold " + unitPixel * 40 + "px Germania One";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(gameState.getDrawPileSize(), drawPileX + cardWidth / 2, drawPileY + cardHeight / 2 + unitPixel * 50);

    // Role

    if(storage.selfRole) {
        ctx.fillStyle = storage.colors.role[storage.selfRole.name()];
        ctx.textAlign = "left";
        ctx.fillText(storage.selfRole.name(), canvas.width / 5 * 4 + unitPixel * 10, unitPixel * 25);
    }

    // Player list

    let playerListX = canvas.width / 5 * 4 + unitPixel * 10;
    let playerListY = unitPixel * 50;
    let playerListWidth = canvas.width / 5 - unitPixel * 20;
    let playerListHeight = unitPixel * 60 * 14; // 14 players max

    ctx.fillStyle = "#363835";
    ctx.fillRect(playerListX, playerListY, playerListWidth, playerListHeight);

    ctx.fillStyle = "white";
    ctx.textAlign = "left";
    ctx.font = "normal bold " + unitPixel * 20 + "px Germania One";
    for(let i = 0; i < storage.room.getPlayers().length; i++) {
        let player = storage.room.getPlayers()[i];
        let playerName = player.getName().substr(0, 20); // TODO

        let isDead = isPlayerDead(player.getID());

        if(player.getID() == storage.selfID) {
            ctx.fillStyle = "green";
        }else if(storage.selfRole) {
            let partyName = storage.selfRole.getParty().name();

            ctx.fillStyle = player.isTeammate ? storage.colors.teammate[partyName] : (player.isLeader ? storage.colors.leader[partyName] : "white");
        }else {
            ctx.fillStyle = "white";
        }

        ctx.fillText(playerName + (isDead ? " (Dead)" : ""), playerListX + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 15);

        if(isDead) {
            ctx.fillRect(playerListX + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 15, ctx.measureText(playerName).width, 2);
        }

        let s = storage.room.getGameState();
        let iconX = playerListX + unitPixel * 10;
        let iconOffsetX = 0;
        let iconY = playerListY + unitPixel * 60 * i + unitPixel * 30;
        let iconSize = unitPixel * 25;

        if(s.getPresident() != null && s.getPresident().getID() == player.getID()) {
            drawImageWithBounds(storage.assets.iconPresident, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }
        
        if(s.getChancellor() != null && s.getChancellor().getID() == player.getID()) {
            drawImageWithBounds(storage.assets.iconChancellor, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }

        if(s.getPreviousPresident() != null && s.getPreviousPresident().getID() == player.getID()) {
            drawImageWithBounds(storage.assets.iconPreviousPresident, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }
        
        if(s.getPreviousChancellor() != null && s.getPreviousChancellor().getID() == player.getID()) {
            drawImageWithBounds(storage.assets.iconPreviousChancellor, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }
        
        if(s.getBlockedPlayer() != null && s.getBlockedPlayer().getID() == player.getID()) {
            drawImageWithBounds(storage.assets.iconPlayerBlocked, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }

        if(isDead) {
            drawImageWithBounds(storage.assets.iconDead, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }

        if(isPlayerNotHitlerConfirmed(player.getID())) {
            drawImageWithBounds(storage.assets.iconNotHitler, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }

        if(isPlayerNotStalinConfirmed(player.getID())) {
            drawImageWithBounds(storage.assets.iconNotStalin, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }

        if(player.vote != null) {
            drawImageWithBounds(player.vote ? storage.assets.iconYes : storage.assets.iconNo, iconX + iconOffsetX, iconY, iconSize, iconSize);
            iconOffsetX += iconSize + unitPixel * 5;
        }
        
        ctx.fillStyle = "lightgray";
        ctx.fillRect(playerListX + unitPixel * 10, playerListY + unitPixel * 60 * i + unitPixel * 60 - unitPixel, playerListWidth - unitPixel * 20, unitPixel * 2);
    }

    // Hand

    if(storage.hand.cards.length != 0) {
        let cardSpacingH = unitPixel * 10;
        ctx.fillStyle = "#363835";
        let x = canvas.width / 2 - storage.hand.cards.length * (cardWidth + cardSpacingH) / 2;
        ctx.fillRect(x, canvas.height - cardHeight, storage.hand.cards.length * (cardWidth + cardSpacingH), cardHeight);
        for(let i = 0; i < storage.hand.cards.length; i++) {
            let selected = storage.hand.selected.indexOf(i) != -1;
            drawImageWithBounds(selected ? storage.assets.articleBack : storage.assets.article[storage.hand.cards[i].name()], x + i * (cardWidth + cardSpacingH) + cardSpacingH / 2, canvas.height - cardHeight + cardSpacingH / 2, cardWidth, cardHeight);
        }
    }


    // Party membership popup

    if(storage.partyPopup != null) {
        ctx.fillStyle = "#363835";
        ctx.fillRect(canvas.width / 2 - unitPixel * 200, canvas.height / 2 - unitPixel * 100, unitPixel * 400, unitPixel * 200);
        
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "normal bold " + unitPixel * 30 + "px Germania One";

        ctx.fillText(storage.partyPopup.player.getName(), canvas.width / 2, canvas.height / 2 - unitPixel * 15);
        ctx.fillText("Membership: " + storage.partyPopup.party.name(), canvas.width / 2, canvas.height / 2 + unitPixel * 15);
    }

    // Winning screen

    if(storage.winner != null) {
        ctx.fillStyle = "#363835";
        ctx.fillRect(canvas.width / 2 - unitPixel * 200, canvas.height / 2 - unitPixel * 100, unitPixel * 400, unitPixel * 200);
        
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "normal bold " + unitPixel * 30 + "px Germania One";

        ctx.fillText("Winner: " + storage.winner.getFriendlyName(), canvas.width / 2, canvas.height / 2);
    }

}

function drawBoard(party, y, board, fullBorder = true) {
    let unitPixel = canvas.width / 1920;
    let cardWidth = unitPixel * 150;
    let cardHeight = cardWidth * 1.45;
    let cardSpacing = unitPixel * 20;

    let colors = storage.colors.board[party.name()];

    ctx.fillStyle = storage.colors.board.background;
    ctx.fillRect(canvas.width / 5, y, canvas.width * 3 / 5, canvas.height / 3);

    ctx.fillStyle = colors.outerFill;
    ctx.fillRect(canvas.width / 5 + unitPixel * 10, y + unitPixel * 5, canvas.width * 3 / 5 - unitPixel * 20, canvas.height / 3 - unitPixel * (fullBorder ? 15 : 10));

    ctx.fillStyle = colors.unsafeFill;
    ctx.fillRect(canvas.width / 2, y + unitPixel * 85 - cardSpacing / 2, (cardWidth + cardSpacing) * 3, cardHeight + cardSpacing);

    ctx.fillStyle = storage.colors.board.infoText;
    ctx.font = "normal bold " + unitPixel * 20 + "px Germania One";
    ctx.fillText(party.getFriendlyName() + " win if " + party.getLeaderName() + " is elected Chancellor", canvas.width / 2 + (cardWidth + cardSpacing) * 3 / 2, y + unitPixel * 90 + cardHeight + cardSpacing, (cardWidth + cardSpacing) * 3);

    for(let cardIdx = 0; cardIdx < 6; cardIdx++) {
        ctx.fillStyle = colors.cardBackground;

        let spaceLeftRight = (canvas.width * 3 / 5 - 6 * (cardSpacing + cardWidth)) / 2;

        let cardOffsetX = canvas.width / 5 + spaceLeftRight;

        ctx.fillRect(cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2, y + unitPixel * 85, cardWidth, cardHeight);

        for(let af of board.getActionFields()) {
            if(af.getFieldIndex() != cardIdx) continue;

            drawImageWithBounds(storage.assets.actions[af.getAction().name()][party.name()], cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2, y + unitPixel * 85, cardWidth, cardHeight);
            break;
        }

        if(board.getNumCards() > cardIdx) {
            drawImageWithBounds(storage.assets.fArticle, cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2, y + unitPixel * 85, cardWidth, cardHeight);
        }

        if(cardIdx == 4) {
            ctx.fillStyle = storage.colors.board.infoText;
            ctx.fillText("+ Veto", cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2 + cardWidth / 2, y + unitPixel * 85 + cardHeight - unitPixel * 20);
        }

        if(cardIdx == 5) drawImageWithBounds(storage.assets.iconWin[party.name()], cardOffsetX + (cardWidth + cardSpacing) * cardIdx + cardSpacing / 2, y + unitPixel * 85, cardWidth, cardHeight);
    }

    ctx.fillStyle = colors.title;
    ctx.font = "normal bold " + unitPixel * 40 + "px Germania One";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(party.getFriendlyNameSingular(), canvas.width / 5 + canvas.width * 3 / 5 / 2, y + unitPixel * 50);
}

function clearClickables() {
    for(let cl of document.getElementsByClassName("clickable")) {
        cl.remove();
    }
}

function clearHoverables() {
    for(let cl of document.getElementsByClassName("hoverable")) {
        cl.remove();
    }
}

function createButton(name, x, y, width, height, onclick) {
    let btn = document.createElement("button");
    btn.textContent = name;
    btn.classList.add("clickable", "ingame-button");
    btn.style.position = "absolute";
    btn.style.left = (x / canvas.width * 100) + "%";
    btn.style.top = (y / canvas.height * 100) + "%";
    btn.style.width = (width / canvas.width * 100) + "%";
    btn.style.height = (height / canvas.height * 100) + "%";
    btn.style.fontSize = "1.5vw";
    btn.onclick = () => onclick(btn);
    canvasDiv.appendChild(btn);
    return btn;
}

function createClickableArea(x, y, width, height, onclick, label = null) {
    let area = document.createElement("div");
    if(label != null) area.title = label;
    area.classList.add("clickable");
    area.style.position = "absolute";
    area.style.left = (x / canvas.width * 100) + "%";
    area.style.top = (y / canvas.height * 100) + "%";
    area.style.width = (width / canvas.width * 100) + "%";
    area.style.height = (height / canvas.height * 100) + "%";
    area.onclick = () => onclick(area);
    canvasDiv.appendChild(area);
    return area;
}

function createHoverableArea(x, y, width, height, label) {
    let area = document.createElement("div");
    if(label != null) area.title = label;
    area.classList.add("hoverable");
    area.style.position = "absolute";
    area.style.left = (x / canvas.width * 100) + "%";
    area.style.top = (y / canvas.height * 100) + "%";
    area.style.width = (width / canvas.width * 100) + "%";
    area.style.height = (height / canvas.height * 100) + "%";
    canvasDiv.appendChild(area);
    return area;
}

function loadImage(assetName) {
    let img = new Image();
    img.src = "assets/" + assetName;
    return img;
}

function drawImageWithWidth(img, x, y, w) {
    let h = w / img.width * img.height;
    ctx.drawImage(img, x, y, w, h);
}

function drawImageWithHeight(img, x, y, h) {
    let w = h / img.height * img.width;
    ctx.drawImage(img, x, y, w, h);
}

function drawImageWithBounds(img, x, y, w, h) {
    let imgAspectRatio = img.width / img.height;
    let aspectRatio = w / h;
    if(imgAspectRatio > aspectRatio) {
        drawImageWithWidth(img, x, y + (1 - (aspectRatio / imgAspectRatio)) * h / 2, w);
    }else {
        drawImageWithHeight(img, x + (1 - (imgAspectRatio / aspectRatio)) * w / 2, y, h);
    }
}

function removeFromArray(array, element) {
    if(array.indexOf(element) == -1) return;
    array.splice(array.indexOf(element), 1);
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