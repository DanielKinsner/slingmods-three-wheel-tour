from pathlib import Path
import json,subprocess,statistics,argparse
r=Path(__file__).resolve().parents[1];e=r/'evidence';c=e/'captures'
parser=argparse.ArgumentParser();parser.add_argument('id');parser.add_argument('label');args=parser.parse_args()
data=json.loads((c/f'profile-{args.id}.json').read_text());t0=data[0]['at']
active=[x for i,x in enumerate(data) if i and x['screen']=='race' and x['raceTime']>data[i-1]['raceTime']]
end=(active[-1]['at']-t0)/1000+3 if active else (data[-1]['at']-t0)/1000
out=e/f'{args.label}.mp4'
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',str(c/f'gameplay-{args.id}.webm'),'-t',str(end),'-vf','scale=1920:-2,fps=30','-c:v','libx264','-preset','veryfast','-crf','23','-c:a','aac','-b:a','128k','-movflags','+faststart',str(out)],check=True)
def stats(values):
 a=sorted(values);return {'samples':len(a),'p50':a[len(a)//2],'p95':a[min(len(a)-1,int(len(a)*.95))],'p99':a[min(len(a)-1,int(len(a)*.99))],'max':a[-1]} if a else None
report={'label':args.label,'original':f'captures/gameplay-{args.id}.webm','profile':f'captures/profile-{args.id}.json','editedVideo':out.name,
 'editing':'Downscaled to1920width at30fps; results tail shortened. Audio retained with no loudness normalization. Any pauses remain; no speed changes.',
 'device':'Windows desktop / RTX4080 / Core i9-12900K / Chrome; not midrange or mobile hardware',
 'renderer':data[0]['backend'],'activeSamples':len(active),'lastRaceTime':max(x['raceTime'] for x in data),
 'sampledCpuFrameMs':None if args.label in ['baseline-daytona','owner-garage'] else stats([x['cpu']['frame'] for x in active]),'smoothedFrameMsNotRawDistribution':stats([x['frameMs'] for x in active]),
 'drawCalls':stats([x['drawCalls'] for x in active]),'triangles':stats([x['triangles'] for x in active]),
 'actualFrameDistribution':data[-1].get('frameProfile'),'viewport':data[-1].get('viewport'),'drawingBuffer':data[-1].get('drawingBuffer'),
 'textures':data[-1].get('textures'),'sampledOutputPeakDb':max(x['audio']['peakDb'] for x in data),'audioListeningApproval':False,
 'GPUFrameTime':'Not measured; CPU submission time and rAF intervals are not GPU timer-query results'}
(e/f'{args.label}-profile.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report))
