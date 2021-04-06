# BetterDiscord EmoteReplacer
Check for known emote names and replace them with an embedded image of the emote.  
Also supports modifiers similar to BetterDiscord's emotes.

# Usage
Install BetterDiscord from here  
https://github.com/BetterDiscord/Installer/releases  
**Reminder: BetterDiscord is against the TOS, use at your own risk!**

Download this library https://raw.githubusercontent.com/rauenzi/BDPluginLibrary/master/release/0PluginLibrary.plugin.js
And the plugin: https://raw.githubusercontent.com/Yentis/betterdiscord-emotereplacer/master/EmoteReplacer.plugin.js
(Rightclick -> Save as...)

Open Discord -> Settings -> Plugins -> Open plugin folder and place the 2 plugins there.  
Enable them in the Plugins menu and hit Ctrl + R.

# Resources
Gif utils code: https://github.com/Yentis/emotereplacer-gifutils  
List of emotes: https://yentis.github.io/emotes  
Want to add an emote? Send me a message on Discord.
Yentis#5218

# Modifiers
**Modifiers can be chained!**  
:flip - Flip emote horizontally.  
:flap - Flip emote vertically.  
:rotate-\<degrees\> - Rotate emote by x degrees.  
:speed-\<speed\> - For gifs, change delay between frames in hundredths of a second.  
:hyperspeed - Remove every other frame and set delay to the minimum for extreme speed.  
:reverse - Make a gif play backwards.  
:spin-\<speed\> - Make your emote spin! Speed can be: left empty, fast, faster or hyper.  
:spinrev-\<speed\> - Same as above but spin in the other direction.  
:slide-\<speed\> - Make your emote slide! Speed can be: left empty, fast, faster or hyper.  
:sliderev-\<speed\> - Same as above but slide in the other direction.  
:shake-\<speed\> - Make your emote shake! Speed can be: left empty, fast, faster or hyper.  
:rainbow-\<speed\> - Make your emote strobe with a rainbow of colors!  Speed can be: left empty, fast, faster or hyper.  
:infinite-\<speed\> - Make your emote pulse outwards!  Speed can be: left empty, fast, faster or hyper.  
:wiggle-\<intensity\> - Make your emote wiggle!  Intensity can be: left empty, big, bigger or huge.  
:wide-\<wideness\> - Make your emote extra wide! Wideness can be: left empty, big, huge, extreme or a number from 2 to 8.  
:resize-\<size\> - Resize your emote. Can be: small, medium, large or a number from 32 to 128.  
:rain-\<option\> - Add a rain effect to the emote. Option can be: left empty, glitter.

**Examples:**  
yentDogSmug:flip  
yentKrisDance:speed-5  
yentKannaDance:rotate-90

# Extra Features
Size - Emotes can be 32 to 128px large, with 48 being the normal emote size.  
Spoilers - Emotes can be hidden behind a spoiler using spoiler tags.  
