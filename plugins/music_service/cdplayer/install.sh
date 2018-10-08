#!/bin/bash

DPKG_ARCH=`dpkg --print-architecture`

if [ ${DPKG_ARCH} = "armhf" ]; then
	LIB_GNUE="/usr/lib/arm-linux-gnueabihf"
elif [ ${DPKG_ARCH} = "i386" ]; then
	LIB_GNUE="/usr/lib/i386-linux-gnu"
fi

echo "Installing cdplayer Dependencies"

#Run this command after changing /etc/apt/sources.list or /etc/apt/preferences . For information regarding /etc/apt/preferences, see PinningHowto. 
#Run this command periodically to make sure your source list is up-to-date. 
#This is the equivalent of "Reload" in Synaptic or "Fetch updates" in Adept.
sudo apt-get update

# Install the required packages via apt-get
# Install library for creating MusicBrainz DiscIDs((-y)automatic yes for promts)
sudo apt-get -y install libdiscid0 eject 

# libdiscid package does not create all symlinks
sudo ln -s ${LIB_GNUE}/libdiscid.so.0 ${LIB_GNUE}/libdiscid.so

# make cd accessable for mpd(music player daemon)
# Add the user to the supplementary group(s)
sudo usermod -aG cdrom mpd

#requred to end the plugin install
echo "plugininstallend"
