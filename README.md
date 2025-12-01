# AdVenture Communist/AdVenture Ages Mission Tracker
A tool that allows players to calculate missions and view event information in the Hyper Hippo mobile games AdVenture Communist and AdVenture Ages. This tool is NO LONGER available at GitHub Pages as of 1 December 2025 due to architectural changes. Please visit <https://idlegametools.com/adcom-mission-tracker/> for the newest updates!

## How to Use
Click on missions in the "Current" area to mark them as Completed.  Click missions in the "Completed" area to undo that, kicking the newest mission back out.

Each mission has a button of its reward capsule next to it.  Clicking this brings up a pop-up with details on the mission, as well as a calculator.  Click "Details" on the calculator for more info.

Switch between Motherland (main) and Event as well as between AdVenture Communist and AdVenture Ages by clicking on the title's dropdown. Other tools can be accessed by clicking around other icons in the top right.

## Technical Background
The website is mainly a static page built upon a single monolith JS file (`mission-tracker.js`). Let's just say I am interested in refactoring it! The server is a simple Node.js/Express instance running on a Docker container. Game data files are stored server-side and can be updated by server administrators.

## Build Instructions
Te website runs on a Docker container. With Docker Compose installed on a Linux/macOS system, run `build.sh` to start the server. Several directories and files which are not present by default are required. Please contact the developer if you are unsure what should go in here.

Assets/images are not provided in the repository as these are copyrighted material.

### .env File
The `.env` file should be structured as follows:

```
# App settings
PORT=
ADMIN_PASSWORD=

# PlayFab settings
PLAYFAB_TITLE_ID_ADCOM=
PLAYFAB_TITLE_ID_AGES=
PLAYFAB_DEVICE_ID=
PLAYFAB_DEVICE_ID_TYPE=
```
The Git Commit ID is passed in by the build script and exposed as an environment variable by Docker itself.

## Contributors
The primary maintainer of this website is Enigma since 2022 with Catster providing additional support. Zephyron is the original creator of the Mission/Capsule Tracker and FAQ documents.

### Asset Contributors
* AdCom Wiki (Icons at launch).
* Eris (event icons).
* Julian (Emoji selection, development assistance).
* Phil109 (Crusade icons, development assistance).
* The_Random_Guy (Balance data at launch).
* Vdisco (Propaganda boost animations).

### Code Contributors
* EdricChan (Bugfix, suggestions).
* Enigma (Several features and assistance).
* Manifold0 (Some dark mode styling).
* Skylark (Improved input parsing).
* The-Snide-Sniper (Bugfix, suggestions).

Special thanks to anybody else that has submitted issues or written pull requests!

## Contributing
I welcome any feedback, bug reports, or pull requests.

If you have any questions, comments, or suggestions, please visit the #engineering channel in the [unofficial AdCom Discord](https://discord.gg/VPa4WTM). We are always happy to help.

## License
All files in this repository with the exception of those in `/public/img`, `/docs/icon.png`, and game data files downloaded into `/data` may be modified or redistributed with credit given to the current owner (Enigma) or original owner (Zephyron), given that it ascribes to the Hyper Hippo Fan Content Policy and all legal stipulations.

This material is not official and is not endorsed by Hyper Hippo. For more information, see Hyper Hippo’s Fan Content Policy: (https://hyperhippo.com/fan-content-policy/)

Last updated: 1 December 2025.