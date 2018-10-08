#!/bin/bash
tsc -p tsconfig.json
sudo systemctl restart volumio
