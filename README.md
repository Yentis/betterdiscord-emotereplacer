# betterdiscord-emotereplacer
Check for known emote names and replace them with an embedded image

# Usage
Install BetterDiscord from here  
https://github.com/rauenzi/BetterDiscordApp/releases  
**Reminder: BetterDiscord is against the TOS, use at your own risk!**

Download this library https://github.com/rauenzi/BDPluginLibrary/blob/master/release/0PluginLibrary.plugin.js  
And the plugin: https://github.com/Yentis/betterdiscord-emotereplacer/blob/master/EmoteReplacer.plugin.js  

Open Discord -> Settings -> Plugins -> Open plugin folder and place the 2 plugins there.  
Enable them in the Plugins menu and hit Ctrl + R.

# Resources
Server code: https://glitch.com/edit/#!/yentis  
List of emotes: https://yentis.github.io/emotes  
Want to add an emote? Ask me for the link.

# Modifiers
**Modifiers can be chained!**  
:flip - Flip emote horizontally.  
:flap - Flip emote vertically.  
:rotate-\<degrees\> - Rotate emote by x degrees, gifs only support 90, 180 or 270 degrees.  
:speed-\<speed\> - For gifs, change delay between frames in hundredths of a second.  
:hyperspeed - Remove every other frame and set delay to the minimum for extreme speed.  
:spin-\<speed\> - Make your emote spin! Speed can be: left empty, fast, faster or hyper.  
:spinrev-\<speed\> - Same as above but spin in the other direction.  
:shake-\<speed\> - Make your emote shake! Speed can be: left empty, fast, faster or hyper. Only works with static emotes for now.  

**Examples:**  
yentDogSmug:flip  
yentKrisDance:speed-5  
yentKannaDance:rotate-90
