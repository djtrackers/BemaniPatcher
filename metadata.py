import argparse
import json
import pefile
import re

from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("-d", "--dll", help="original dll filename", default="game.dll")
parser.add_argument("-c", "--code", help="game code prefix", default="M32")
parser.add_argument("-n", "--name", help="id and name", default="GITADORA FUZZ-UP")
args = parser.parse_args()

output = {"id": args.name, "name": args.name, "patches": {args.dll: {}}}

for f in Path(".").glob(f"{Path(args.dll).stem}*.dll"):
    pe = pefile.PE(f, fast_load=True)
    tds = pe.FILE_HEADER.TimeDateStamp
    aoep = pe.OPTIONAL_HEADER.AddressOfEntryPoint

    d = re.search(r"\d{10}", str(f)).group()
    d = "-".join([d[:4], d[4:6], d[6:8], d[8:]])
    date = d[:-3] if d[-3:] == "-00" else d

    output["patches"][args.dll][date] = {
        "GameCodePrefix": args.code,
        "TimeDateStamp": tds,
        "AddressOfEntryPoint": aoep,
    }
    print(date, tds, aoep)

filename = "".join(e for e in args.name if e.isalnum()).lower() + ".json"

with open(filename, mode="w", newline="\n") as f:
    json.dump(output, f, indent=4)

print()
print(f"{args.code} metadata saved to {filename} ({len(output["patches"][args.dll])} total)")
