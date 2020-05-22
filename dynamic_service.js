const DYNAMIC_MODE='dynamic';

class DynamicService {
  constructor(context) {
    this.context = context;
  }

  run() { 
    this.context.nodeEvent.on('prePublish', this.onPrePublish.bind(this));
    this.context.nodeEvent.on('donePlay', this.onDonePlay.bind(this)); 
  }

  onPrePublish(id, streamPath, args){
  //TODO 处理动态推流
    if (args.mode && args.mode===DYNAMIC_MODE){
      const { idlePlayers, sessions } = this.context;
      let isNeeded=false;
      for (let idlePlayerId of idlePlayers) {
        if (sessions.has(idlePlayerId)) {
          let idlePlayer = sessions.get(idlePlayerId);
          if (idlePlayer.playStreamPath===streamPath) {
            isNeeded=true;
            break;
          }
        }
      } 
      if ((!isNeeded) && sessions.has(id)) {
        let session = sessions.get(id);
        session.reject();
      }  
    }
  }

  onDonePlay(id, streamPath, args){
    const { idlePlayers, sessions } = this.context;
    let thisPublisher;
    for (let session of sessions) {
      if (streamPath===session[1].publishStreamPath) {
        thisPublisher = session[1];
        break;
      }
    } 

    if (!thisPublisher) { return; }

    const { publishArgs, players } = thisPublisher;
    if (!(publishArgs && publishArgs.mode && publishArgs.mode===DYNAMIC_MODE)) {
      return;
    }

    let shouldBeDisconnect =true;
    for (let playerId of players) {
      if (playerId === id) {
        continue;
      }

      const player= sessions.get(playerId);
      if (player.playStreamPath===streamPath) {
        shouldBeDisconnect =false;
        break;
      }
    }

    if (shouldBeDisconnect) {
      thisPublisher.reject();
    }
  }
}

module.exports = DynamicService;