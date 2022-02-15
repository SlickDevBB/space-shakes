// game.js

// const gameWidth = 600;
// const gameHeight = 450;

let gameWidth = window.innerWidth;
let gameHeight = gameWidth * 3/4;

if (gameHeight > window.innerHeight) {
  gameHeight = window.innerHeight;
  gameWidth = gameHeight * 4/3;
}

gameWidth *= 0.975;
gameHeight *= 0.975;

var config = {
    type: Phaser.AUTO,
    parent: 'phaser-example',
    width: gameWidth,
    height: gameHeight,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
        gravity: { y: 0 }
      }
    },
    scene: {
      preload: preload,
      create: create,
      update: update
    } 
  };
  var game = new Phaser.Game(config);

  function preload() {
    this.load.image('rasta', 'assets/rasta.png');
    this.load.image('viking', 'assets/viking.png');
    this.load.image('milkshake', 'assets/milkshake.png');
    this.load.image('find-match', 'assets/find-match.png');
    this.load.image('searching', 'assets/searching.png');
    this.load.image('stars', 'assets/stars.jpeg');
  }

  function create() {
    // create the socket reference
    this.socket = io();

    this.playStarted = false;

    // create the find-match button
    this.findMatchButton = this.add.image(gameWidth/2, gameHeight*0.85, 'find-match');
    this.findMatchButton.setDisplaySize(gameWidth*0.4, gameHeight*0.15);
    this.findMatchButton.setDepth(1);
    this.findMatchButton.setInteractive();
    this.findMatchButton.on('pointerup', () => {
      this.socket.emit('findMatch');
      this.findMatchButton.setTexture('searching');
      this.winText.setVisible(false);
      this.loseText.setVisible(false);

      // hide logo image
      this.logoMilkshake.setVisible(false);
    })

    // create our background
    this.bgStars = this.add.image(gameWidth/2, gameHeight/2, 'stars')
      .setDisplaySize(gameWidth, gameHeight)
      .setOrigin(0.5, 0.5)

    // add milkshake image for logo
    this.logoMilkshake = this.add.image(gameWidth/2, gameHeight/2, 'milkshake')
      .setDisplaySize(gameHeight*0.125, gameHeight*0.25)
      .setOrigin(0.5, 0.5)
      .setAlpha(0)
      .setVisible(true)

    // fade in milkshake logo
    this.add.tween({
      targets: this.logoMilkshake,
      alpha: 1,
      duration: 2000,
    })

    // set a spinning tween for object
    this.add.tween({
      targets: this.logoMilkshake,
      angle: 360,
      duration: 2000,
      repeat: -1,
    })

    // add title text
    this.titleText = this.add.text(gameWidth/2, gameHeight*0.1, 'Space Shakes', { fontSize: (gameHeight*0.12).toString() + 'px', fill: '#ff52ee', align: 'center' });
    this.titleText.setOrigin(0.5,0.5);
    this.subtitleText = this.add.text(gameWidth/2, gameHeight*0.22, 'Collect 5 Milkshakes to Win\n(Click & Hold Location You Want to Move to)', { fontSize: (gameHeight*0.04).toString() + 'px', fill: '#ff52ee', align: 'center' });
    this.subtitleText.setOrigin(0.5,0.5);

    // add win and lose text
    this.winText = this.add.text(gameWidth/2, gameHeight/2, 'You Win!', { fontSize: (gameHeight*0.1)+'px', fill: '#ff52ee', align: 'center' }).setVisible(false).setOrigin(0.5,0.5);
    this.loseText = this.add.text(gameWidth/2, gameHeight/2, 'You lose...', { fontSize: (gameHeight*0.1)+'px', fill: '#ff52ee', align: 'center' }).setVisible(false).setOrigin(0.5,0.5);

    // add score text
    this.rastaScoreText = this.add.text(gameWidth*0.12, gameHeight*0.065, '', { fontSize: (gameHeight*0.05)+'px', fill: '#73d3ff', align: 'center' }).setOrigin(0.5,0.5);
    this.vikingScoreText = this.add.text(gameWidth*0.88, gameHeight*0.065, '', { fontSize: (gameHeight*0.05)+'px', fill: '#ff2b2b', align: 'center' }).setOrigin(0.5,0.5);
    
    // text that shows at start of a match
    this.battleText = this.add.text(gameWidth/2, gameHeight/2, "On Team Rasta and Starting in\n\n3", { fontSize: (gameHeight*0.065)+'px', fill: '#73d3ff', align: 'center' }).setVisible(false).setOrigin(0.5,0.5);
    this.battleText.setDepth(100);

    // create some other players
    this.otherPlayers = this.physics.add.group();

    // call this when we get updated current players
    this.socket.on('currentPlayers', players => {
      // add each player that is in the same match as us
      Object.keys(players).forEach( id => {
        if (players[id].playerId === this.socket.id) {
          addPlayer(this, players[id]);
          console.log('"currentPlayers" adding player');
        } else if (players[id].match === players[this.socket.id].match) {
          console.log('"currentPlayers" adding other player');
          addOtherPlayer(this, players[id]);
        }
      })
    })

    // call this when a new player is added by the server
    this.socket.on('newPlayer', player => {
      if (player.playerId !== this.socket.id) {
        addOtherPlayer(this, player);
        console.log('"newPlayer" adding other player');
      }
    })

    // remove player on disconnect
    this.socket.on('removePlayer', id => {
      this.otherPlayers.getChildren().forEach( otherPlayer => {
        if (id === otherPlayer.playerId) {
          otherPlayer.destroy();
        }
      });
    });

    this.socket.on('playerMoved', playerInfo => {
      this.otherPlayers.getChildren().forEach( otherPlayer => {
        if (playerInfo.playerId === otherPlayer.playerId) {
          otherPlayer.setRotation(playerInfo.rotation);
          otherPlayer.setPosition(playerInfo.x*gameWidth, playerInfo.y*gameHeight);
        }
      });
    });

    // update our text
    this.socket.on('scoreUpdate', (scores) => {
      if (this.rastaScoreText && this.vikingScoreText) {
        this.rastaScoreText.setText('Rasta: ' + scores.rasta);
        this.vikingScoreText.setText('Viking: ' + scores.viking);
      }
    });

    // add a milkshake sprite on update
    this.socket.on('milkshakeUpdate', milkshake => {
      if (this.milkshake) this.milkshake.destroy();
      this.milkshake = this.physics.add.sprite(milkshake.x * gameWidth, milkshake.y * gameHeight, 'milkshake');
      this.milkshake.setDisplaySize(gameWidth*0.035, gameWidth*0.07)

      // if match isn't started milkshakes should still be invisible
      this.milkshake.setVisible(this.playStarted);

      this.physics.add.overlap(this.gotchi, this.milkshake, () => {
        console.log('collision');
        this.socket.emit('milkshakeSlurped');
      });
    });

    // define what happens when match starts
    this.socket.on('startMatch', () => {
      // change text visibility
      this.findMatchButton.setVisible(false);
      this.rastaScoreText.setVisible(true);
      this.vikingScoreText.setVisible(true);
      this.titleText.setVisible(false);
      this.subtitleText.setVisible(false);

      // ensure milkshake starts invisible
      if (this.milkshake) this.milkshake.setVisible(false);

      // show battle text and commence count down
      const team = this.gotchi.texture.key === 'rasta' ? 'Rasta' : 'Viking';
      console.log(this.gotchi.texture);
      const teamColour = this.gotchi.texture.key === 'rasta' ? '#73d3ff' : '#ff2b2b';
      this.battleText.setVisible(true);
      this.battleText.setColor(teamColour);
      this.battleText.text = "On Team " + team + " and Starting in\n\n3";
      setTimeout(() => {
        this.battleText.text = "On Team " + team + " and Starting in\n\n2";
      }, 1000)
      setTimeout(() => {
        this.battleText.text = "On Team " + team + " and Starting in\n\n1";
      }, 2000)
      setTimeout(() => {
        this.battleText.setVisible(false);
        this.milkshake.setVisible(true);
        this.playStarted = true;
      }, 3000)

    });

    // define what happens when match ends
    this.socket.on('endMatch', winningPlayer => {
      if (winningPlayer.playerId === this.socket.id) {
        this.winText.setVisible(true);
      } else {
        this.loseText.setVisible(true);
      }

      // destroy our milkshake
      this.milkshake.destroy();
      delete this.milkshake;

      // start fading out the player sprites
      this.add.tween({
        targets: this.gotchi,
        alpha: 0,
        duration: 3000,
      });

      // fade out other players
      this.otherPlayers.getChildren().forEach( op => {
        this.add.tween({
          targets: op,
          alpha: 0,
          duration: 3000,
        })
      })

      // set a timeout to hide the win/lose text and reshow the logo image
      setTimeout( () => {
        // fade in milkshake logo
        this.logoMilkshake.setAlpha(0);
        this.logoMilkshake.setVisible(true);
        this.add.tween({
          targets: this.logoMilkshake,
          alpha: 1,
          duration: 2000,
        })

        // hide win/lose text
        this.winText.setVisible(false).setAlpha(1);
        this.loseText.setVisible(false).setAlpha(1);

        // show find match button again and set its texture back to find match
        this.findMatchButton.setVisible(true);
        this.findMatchButton.setTexture('find-match');

        // hide scores
        this.rastaScoreText.setVisible(false);
        this.vikingScoreText.setVisible(false);

        // reshow title text
        this.titleText.setVisible(true);
        this.subtitleText.setVisible(true);

        // destroy our gotchi
        this.gotchi.destroy();
        delete this.gotchi;

        // destroy other players
        console.log(this.otherPlayers.getChildren());
        this.otherPlayers.getChildren().forEach( op => { op.destroy(); } );

        // let server know cleanup finished
        this.socket.emit('endMatchCleanUpComplete');

        // reset match started status
        this.playStarted = false;

      }, 3000);

      
      
    })

    // add controls
    this.cursors = this.input.keyboard.createCursorKeys();

  }

  function update() {
    // process events based on cursor controls
    if (this.gotchi) {
      if (this.cursors.left.isDown) {
        this.gotchi.setAngularVelocity(-300);
      } else if (this.cursors.right.isDown) {
        this.gotchi.setAngularVelocity(300);
      } else {
        this.gotchi.setAngularVelocity(0);
      }
    
      if (this.cursors.up.isDown) {
        this.physics.velocityFromRotation(this.gotchi.rotation-Math.PI/2, gameWidth, this.gotchi.body.acceleration);
      } else {
        this.gotchi.setAcceleration(0);
      }

      // do mouse input
      if (this.input.activePointer.isDown) {
        const pointer = this.input.activePointer;

        // first calculate vector between where we clicked and where our gotchi is
        const click = new Phaser.Math.Vector2(pointer.x/gameWidth, pointer.y/gameHeight);
        const gotchi = new Phaser.Math.Vector2(this.gotchi.x/gameWidth, this.gotchi.y/gameHeight);
        
        // determine the target rotation
        const targetRad = Phaser.Math.Angle.Between(
          gotchi.x, gotchi.y,
          click.x, click.y
        );

        // store the gotchi current rotation
        const currentRad = this.gotchi.rotation;
        
        // store delta
        let diffRad = targetRad - currentRad + Math.PI/2;
        const diffRadOG = diffRad;

        if (diffRad < -Math.PI) diffRad += Math.PI * 2;
        else if (diffRad > Math.PI) diffRad -= Math.PI * 2;
         
        // calc our new physics velocity
        this.physics.velocityFromRotation(targetRad, gameWidth, this.gotchi.body.acceleration);

        // console.log('Target Radians: ' + targetRad);
        // console.log('Gotchi Radians: ' + currentRad);

        // tween into correct orientation
        this.add.tween({ 
          targets: this.gotchi,
          rotation: currentRad + diffRad,
          duration: 10,
        })
      }

      // emit player movement
      var x = this.gotchi.x/gameWidth;
      var y = this.gotchi.y/gameHeight;
      var r = this.gotchi.rotation;
      if (this.gotchi.oldPosition && (x !== this.gotchi.oldPosition.x || y !== this.gotchi.oldPosition.y || r !== this.gotchi.oldPosition.rotation)) {
        this.socket.emit('playerMovement', { x: x, y: y, rotation: r });
      }

      // save old position data
      this.gotchi.oldPosition = {
        x: this.gotchi.x/gameWidth,
        y: this.gotchi.y/gameHeight,
        rotation: this.gotchi.rotation
      };
    }  
  }

  const addPlayer = (self, playerInfo) => {
    self.gotchi = self.physics.add.sprite(playerInfo.x * gameWidth, playerInfo.y * gameHeight, playerInfo.team);
    self.gotchi.setOrigin(0.5, 0.5);
    self.gotchi.setDisplaySize(gameWidth*0.1, gameWidth*0.1);
    self.gotchi.setDamping(true);
    self.gotchi.setDrag(0.25);
    self.gotchi.setAngularDrag(0.25);
    self.gotchi.setMaxVelocity(gameWidth);
    self.gotchi.setCollideWorldBounds(true);
    self.gotchi.setBounce(0.75);
    self.gotchi.setDepth(10);
  }

  const addOtherPlayer = (self, playerInfo) => {
    const otherPlayer = self.add.sprite(playerInfo.x * gameWidth, playerInfo.y * gameHeight, playerInfo.team)
    otherPlayer.setRotation(playerInfo.rotation);
    otherPlayer.setOrigin(0.5, 0.5)
    otherPlayer.setDisplaySize(gameWidth*0.1, gameWidth*0.1);
    otherPlayer.setDepth(10);
    otherPlayer.playerId = playerInfo.playerId;
    self.otherPlayers.add(otherPlayer);
  }