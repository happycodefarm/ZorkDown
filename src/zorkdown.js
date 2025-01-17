/**
zorkdown.js
========

- authors:
  - abstractmachine
  - a line
  - Bergamote
  - flatland666
  - Flore G
  - Juste Leblanc
  - Velvet

- version:
  0.3

A single-file, single-class Zork-like interactive text game engine.
It interprets a lightweight markup language called Zorkdown .
*/

/**
Core Zorkdown engine class
==========================
*/

'use strict' // just because javascript is permissive enough

class Zorkdown {

  /**
  ZorkDown class constructor
  
  - parameters:
    source: The Zorkdown story source code string.
  
  */
  constructor(source) {
    this.story = {
      places:[],
      defaults: null,
      currentPlace: null,
      placeChanged: false,
      states: {},
      source: null
    } // The main story object

    this.placeChangedCallback = null
    this.errorCallback = null
    this.story.source = source
    this.parseStory(source)
  }
  
  setPlaceChangedCallbackFunction(callback) {
    this.placeChangedCallback = callback
  }

  setErrorCallbackFunction(callback) {
    this.errorCallback = callback
  }

  placeChanged(p) {
    if (typeof this.placeChangedCallback === 'function') {
      this.placeChangedCallback(p)
    }
  }

  errorRaised(e) {
    if (typeof this.errorCallback === 'function') {
      this.errorCallback(e)
    }
  }


  /**
  Parse a player message and return an answer.

  - parameters:
    - message: The player message string.
    - place: A string contaning the name of the place from where the message is issued.

  - returns:
    The message response string from the story engine.
  */
  parseMessage(message, place) {
    message = message
    let reply = ""
  
    if (message == 'inventory') return this.getInventory()

    // juste au cas où le salon n'a pas d'actions définies
    if (place == null || !place.hasOwnProperty("actions")) {
      return "nop"
    }

    // rechercher une action correspondant au message dans le salon actuel
    let action = this.findMatchingAction(message, place.actions)
    // si aucune action trouvée, faire une recherche dans les reponses par default
    if (action == null) {
      action = this.findMatchingAction(message, this.story.defaults.actions)
    }
    if (action == null) {
      action = this.findMatchingAction("*", place.actions)
    }
    if (action == null) {
      action = this.findMatchingAction("*", this.story.defaults.actions)
    }
    if (action == null) return null
  
    for (const response of action.responses) { // toutes les responses de l'action
      let conditionsStates = []

      if (!this.isEmpty(response.conditions)) { // la réponse est soumise à condition(s)
      
        let oneOk = false
        for (const condition of response.conditions) { // tous les & 
          let ok = true

          for (const conditionPart in condition) {
          
            if (this.story.states[conditionPart] == null) console.log(`Parser warning: "${conditionPart}" not declared !`)
            if ((this.story.states[conditionPart] != null) && (this.story.states[conditionPart].state != condition[conditionPart])) {
              // the condition is not reached
              ok = false
              break; // AND condition not satisfied, no needs to go further
            } 
          }
          if (ok) { // OR condition satisfied
            oneOk = true
            break
          } 
        }
        
        let tmpReply = oneOk ? this.getPassedResponse(response) : this.getFailedResponse(response)
        tmpReply = this.computeReply(tmpReply)
        reply += tmpReply != null ? `${tmpReply} ` : ""
        if (!oneOk && response.fail.length) {
          break // stop going down to next condition when a condition failed to pass
        }
      } else reply =`${reply} ${this.computeReply(this.getPassedResponse(response))} `
    }
    return reply
  }
  
  /**
    Return a random response from a set of possible positive responses.
  
    - parameters: 
      response: A response object containing an array of possible responses.
  
    - returns:
      A response as string.
    */
  getPassedResponse(response) {
    return response.pass[Math.floor(Math.random() * response.pass.length)]
  }
  
  /**
  Return a random response from a set of possible negative responses.
  
    - parameters:
      response: A response object containing an array of possible responses.
  
    - returns:
      A response as string.
    */
  getFailedResponse(response) {
    return response.fail[Math.floor(Math.random() * response.fail.length)]
  }
  
  /**
     Analyse a response string and update the story states if needed.
  
    - parameter: 
    reply: A reply string from story engine.
  
    - returns:
      The cleaned response string ..
    */
  computeReply(reply) {
    if (reply == null) return null
    let regexSetter = /{\s*(@|\+\+|\+|--|-|=)\s*([^}\n\r]*)}/gm
    let resultSetter = [...reply.matchAll(regexSetter)]
  
    for (const result of resultSetter) {
      let operator = result[1]
      let variable = result[2]
      if (operator == "@") { // 'change place' command
        
        let newPlace = this.getPlaceByName(variable.toLowerCase())
        if ((newPlace) !== null) {
          this.story.currentPlace = variable
          this.story.placeChanged = true
          this.placeChanged(newPlace)
        } else {
          this.errorRaised(`Error: computeReply, no place named ${variable}`)
        }
       
      } else if (operator == "=") { // 'death' command
        if (variable == "death") {
          this.parseStory(this.story.source) // restart the game
          this.story.placeChanged = true
          this.placeChanged()
        }	
      } else { // property setter (+ or - or ++ or --)
        let split = variable.split(/(\-\>)/).filter( e => e.trim().length > 0) 
        let variableName = split[0].trim()
        let description = split[2] ? split[2].trim() : null

        if (!this.story.states[variableName]) { // Add the variable to the story.
          let state
          if (operator == "+") state = true
          else if (operator == "-") state = false
          else if (operator == "--") state = 0
          else if (operator == "++") state = 1
          this.story.states[variableName] = {
            "state": state,
            "description": description
          }

        } else { // The variable allready exist, update it.
          if (description != null) this.story.states[variableName].description = description // set the variable description string for inventory
          let state
          if (operator == "+") state = true
          else if (operator == "-") state = false
          else if (operator == "--") state = this.story.states[variableName].state - 1
          else if (operator == "++") state = this.story.states[variableName].state + 1

          this.story.states[variableName].state = state
        }
      }		
    }
    return reply.replace(regexSetter, "")
  }
  
  /**
    Parse the story source code and build the game structure from it.
  
    - parameters:
      source: The ZorkDown string source of the story.
    */
  parseStory(source) {
    const scenarioLines = source.split(/[\r\n]+/g)

    // restet strory properties
    this.story.places=[]
    this.story.defaults=null
    this.story.currentPlace=null
    this.story.placeChanged=false
    this.story.states={}
    
    // save story to a json file
    this.story.toJson = function() {
      const json = JSON.stringify(this.story, null, 4)
      return json
    }
    
    let place, action, responses, metadata 
    
    const placeTemplate = function (name) {
      return { "name": name, "actions": [], "data": {}}
    }
    
    const actionTemplate = function (commands) {
      return { "commands":commands, "responses": [] }
    }
  
    const responsesTemplate = function () {
      return {"conditions":[], "pass":[], "fail":[]}
    }
  
    var lastTag = null

    place = placeTemplate("everywhere")
    this.story.defaults = place
    let lineIndex = 0
    let line = ""
    try {
      for (lineIndex in scenarioLines) {
        line = scenarioLines[lineIndex]

        switch(line.trim()[0]) {
          case "#": // nouveau salon
            lastTag = "#"
            action = null
            responses = null
            // créer un nouvel objet place avec son nom
            const placeName = line.substring(1).trim()
            place = placeTemplate(placeName)
            this.story.places.push(place) // add the new place to the story
            break
            
          case "{":
            lastTag = "{"
            let data = JSON.parse(line.trim())
            for (var i in data) {
              place.data[i] = data[i]
            }
            break
          case "!": // action(s) du salon
            lastTag = "!"
            // trouver toutes les actions et synonymes : fait ci / fait ça / fait quoi
            let allCommands = line.substring(1).trim()
            let commands = allCommands.split(/\//g).map(s => s.trim()).filter( e => e.length > 0)// séparer les actions par /
            
            action = actionTemplate(commands)
            responses = null
            
            place.actions.push(action) // ajouter l'objet action au salon
            break;
          case "?": // condition de réaction
            lastTag = "?"
            responses = responsesTemplate()
            let allConditions = line.substring(1).trim()

            // AND OR order of operations
            // evaluate AND first
            // midi & faim / midi & soif == (midi & faim) / (midi & soif)
            let conditionOr = allConditions.split(/\//g).map(s => s.trim()).filter( e => e.length > 0)// séparer les bloc de conditions par /
            let conditionsGroup = []
            
            for (const conditionsAnd of conditionOr) { // les groupes de /
              let conditions = conditionsAnd.split(/\&/g).map(s => s.trim()).filter( e => e.length > 0)// séparer les conditions par &
              let conditionsParts = {}
              for (const condition of conditions) { // les groupes de &
                if (condition[0]=="!") {
                  conditionsParts[condition.substring(1).trim()]= false
                  this.story.states[condition.substring(1).trim()] = {
                    "state":false,
                    "description": null
                  }
                } else {
                  conditionsParts[condition]= true
                  this.story.states[condition] = {
                    "state":false,
                    "description": null
                  }
                }
              }
              conditionsGroup.push(conditionsParts)
            }
            responses.conditions = conditionsGroup
            action.responses.push(responses)
            break;	
          case "+": // pass condition 
            lastTag = "+"
            if (responses===null) {
              responses = responsesTemplate()
              action.responses.push(responses)
            }
            let positiveResponse = line.substring(1).trim()
            responses.pass.push(positiveResponse)
            break;
          case "-": // fail condition
            lastTag = "-"
            if (responses===null) {
              responses = responsesTemplate()
              action.responses.push(responses)
            }
            let negativeResponse = line.substring(1).trim()
            responses.fail.push(negativeResponse)
            break
          case ">": // ignore commented lines
            break
          default:
            if (responses != null) {
              if (lastTag == "+") {
                responses.pass[responses.pass.length - 1] += `\n${line}`
              } else if(lastTag == "-") {
                responses.fail[responses.fail.length - 1] += `\n${line}`
              } else {
                this.errorRaised(`Warning, syntaxe error at line ${line}`)
              }
            }
        }
      }	
  } catch (e) {
    this.errorRaised(`Error parsing source code at line ${lineIndex} near ${line}`)
    alert(`Error parsing source code at line ${lineIndex} near ${line}`)
  }
  // to do handle no place
    this.story.currentPlace = this.story.places[0].name
  }
  
  /**
    Find a place in story by it's name.
  
    - parameters:
      placeName: The name of the place to find in story.
  
    - returns:
      The matching place object or null on failure.
    */
  getPlaceByName(placeName) {
    console.log('placeName')
    console.log(placeName)
    for (const place of this.story.places) {
      if (place.name.toLowerCase() == placeName.toLowerCase()) {
        return place
      }
    }
    this.errorRaised(`Error: getPlaceByName, no place named ${placeName}`)

    // no place with that name, return null
    return null
  }
  
  /**
    Find a matching action from a sentence in a set of action objects.
  
    - parameters:
      - sentence: The user input string.
      - actions: A set of action objects containing a set of commands and associated answsers.
  
    - returns:
      An object with the matching answers or null if none was found. 
    */
  findMatchingAction(sentence, actions) {
    const sentenceWords = sentence.split(/(\s+)/)
                                  .filter( e => e.trim().length > 0)
                                  .map( e => e.toLowerCase())
                                  .map(e => e.replace("l'", "")) // remove apostrophes
                                  .map(e => e.normalize("NFD").replace(/\p{Diacritic}/gu, "")) // normalize accents

    // sentence words
    let result = null
    let score = 0
    for (const i in actions) {
      let commands = actions[i].commands
        for (const j in commands) {
          let commandParts = commands[j].split(/(\s+)/).map(s => s.trim()).filter( e => e.length > 0)
                                        .map( e => e.toLowerCase())
                                        .map(e => e.replace("l'", "")) // remove apostrophes
                                        .map(e => e.normalize("NFD").replace(/\p{Diacritic}/gu, "")) // normalize accents

          // https://stackoverflow.com/questions/1187518/how-to-get-the-difference-between-two-arrays-in-javascript
          let intersection = sentenceWords.filter(x => commandParts.includes(x))
          // command match action 
          if (intersection.length == commandParts.length) {
            // set only if matching score is higher than previous match
            if (score <= intersection.length) {
              result = actions[i]
              score = intersection.length
            }
          }
        }
    }
    return result
  }

  /**
  Get the player inventory.

  - note:
    The inventory list all the story states with a description that are true.

  - returns:
    A string with the inventoy list.
  */
  getInventory() {
    let inventory = []
    for (const state in this.story.states) {  
      console.log(`${state} : ${this.story.states[state].state}, ${this.story.states[state].description}`)   
      if (this.story.states[state].state == true && this.story.states[state].description !== null) {
        inventory.push(this.story.states[state].description)
      }
    }
    if (inventory.length > 0) return "You have:\n- "+inventory.join("\n- ")
    else return "You are empty handed."
  }

  /**
  Get a 'map' of the game story.

  - returns:
    A json object reprsenting the story map.
  */
  getMap() {
    let map = {
      "places":[]
    }

    let regex = /{\s*(@)\s*([^}\n\r]*)}/gm

    for (const place of this.story.places) {
      let placeObject = {"name":place.name, "connections":[]}
      
      for (const action of place.actions) {
        for (const response of action.responses) {
          for (const pass of response.pass) {
            let results = [...pass.matchAll(regex)]
            for (const result of results) {
              let placename = result[2]
              placeObject["connections"].push(placename)
            }
          }
          for (const fail of response.fail) {
            let results = [...fail.matchAll(regex)]
            for (const result of results) {
              let placename = result[2]
              placeObject["connections"].push(placename)
            }
          }
        }
      }
      // remove duplicates in array
      placeObject["connections"] = placeObject["connections"].filter((v, i, a) => a.indexOf(v) === i)
      map["places"].push(placeObject)
    }
    return map
  }

  /**
  Return the emptiness of an object.
  
  - parameters:
    obj: The object to test for emptiness.

  - returns:
    A boolean reprsenting the emptiness of the object.
    */
  isEmpty(obj) {
    for(let key in obj) {
        if(obj.hasOwnProperty(key)) return false;
    }
    return true;
  }
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Zorkdown
}