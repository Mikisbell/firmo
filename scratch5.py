import re

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\CheckDetail.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace main container
content = content.replace(
    '<div className="h-full flex flex-col bg-gray-50 border-l border-gray-200 shadow-xl">',
    '<div className="h-full flex flex-col bg-park-black border-l border-white/10 shadow-2xl">'
)

# Replace Header
content = content.replace(
    '<div className="bg-white border-b shadow-sm sticky top-0 z-10 flex flex-col">',
    '<div className="bg-zinc-900/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-10 flex flex-col">'
)
content = content.replace(
    '<button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-600">',
    '<button onClick={onBack} className="p-2 hover:bg-white/10 rounded-full transition-colors text-zinc-400 hover:text-white">'
)
content = content.replace(
    '<h2 className="font-bold text-lg text-gray-900 leading-tight">',
    '<h2 className="font-bold text-lg text-white leading-tight">'
)
content = content.replace(
    '<span className={`px-2 py-0.5 rounded-full ${isPaid ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>',
    '<span className={`px-2 py-0.5 rounded-full uppercase tracking-wider text-[10px] font-bold ${isPaid ? "bg-emerald-500/20 text-emerald-400" : "bg-yellow-500/20 text-yellow-400"}`}>'
)
content = content.replace(
    '<span className="text-gray-400">#{check.check_id.slice(0, 4)}</span>',
    '<span className="text-zinc-500 font-mono">#{check.check_id.slice(0, 4)}</span>'
)
content = content.replace(
    'className="bg-amber-50 hover:bg-amber-100 text-amber-800 px-3 py-2 rounded-lg text-xs font-bold border border-amber-300 flex items-center gap-2 min-h-[44px] touch-manipulation"',
    'className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 px-3 py-2 rounded-lg text-xs font-bold border border-amber-500/30 flex items-center gap-2 min-h-[44px] touch-manipulation"'
)
content = content.replace(
    'className="bg-zinc-100 hover:bg-zinc-200 text-zinc-900 px-3 py-2 rounded-lg text-xs font-bold border border-zinc-300 flex items-center gap-2 min-h-[44px] touch-manipulation"',
    'className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-2 rounded-lg text-xs font-bold border border-zinc-700 flex items-center gap-2 min-h-[44px] touch-manipulation"'
)

# Replace Tabs selector colors
content = content.replace(
    '? "bg-gray-900 text-white border-gray-900 shadow-md transform scale-105"',
    '? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-500/20 transform scale-105"'
)
content = content.replace(
    ': "bg-white text-gray-600 border-gray-200 hover:border-gray-300"',
    ': "bg-zinc-800 text-zinc-400 border-zinc-700 hover:border-zinc-600 hover:text-white"'
)

# Items List background
content = content.replace(
    '<div className="flex-1 overflow-y-auto p-4 space-y-1 bg-[#f8f9fa] relative">',
    '<div className="flex-1 overflow-y-auto p-4 space-y-2 bg-park-black relative">'
)
content = content.replace(
    '''bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAxMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMTBMMTAgMEwyMCAxMEgwWiIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==')]''',
    '''bg-transparent'''
)

# Empty state
content = content.replace(
    '<p className="font-mono text-xs uppercase tracking-widest">Ticket Vacío</p>',
    '<p className="font-mono text-xs uppercase tracking-widest text-zinc-500">Ticket Vacío</p>'
)

# Inside items box
content = content.replace(
    '<div className="bg-white shadow-sm border border-gray-200 rounded-sm p-4 min-h-full flex flex-col">',
    '<div className="bg-zinc-900 shadow-lg border border-white/5 rounded-2xl p-4 min-h-full flex flex-col">'
)
content = content.replace(
    '<h3 className="font-black text-xl uppercase tracking-widest text-gray-900">PARK POS</h3>',
    '<h3 className="font-black text-xl uppercase tracking-widest text-white">PARK POS</h3>'
)
content = content.replace(
    'className="text-center border-b border-dashed border-gray-300 pb-4 mb-4"',
    'className="text-center border-b border-dashed border-white/10 pb-4 mb-4"'
)

# Item rows
content = content.replace(
    '<div className="flex items-center gap-2 text-sm text-gray-800 flex-1 min-w-0">',
    '<div className="flex items-center gap-3 text-sm text-zinc-200 flex-1 min-w-0">'
)
content = content.replace(
    '<span className="font-mono font-bold w-6 text-right flex-shrink-0">{l.qty}</span>',
    '<span className="font-mono font-bold w-8 text-center bg-zinc-800 text-emerald-400 py-1 rounded-md flex-shrink-0">{l.qty}</span>'
)
content = content.replace(
    '<span className="font-medium group-hover:text-black truncate">{name}</span>',
    '<span className="font-medium group-hover:text-white truncate">{name}</span>'
)
content = content.replace(
    '<span className="text-sm font-mono text-gray-600">',
    '<span className="text-base font-mono font-bold text-white tracking-tight">'
)

# Buttons in row
content = content.replace(
    'bg-gray-100 hover:bg-red-100 flex items-center justify-center text-gray-500 hover:text-red-600',
    'bg-zinc-800 hover:bg-red-500/20 flex items-center justify-center text-zinc-400 hover:text-red-400 border border-transparent hover:border-red-500/30'
)
content = content.replace(
    'bg-gray-100 hover:bg-green-100 flex items-center justify-center text-gray-500 hover:text-green-600',
    'bg-zinc-800 hover:bg-emerald-500/20 flex items-center justify-center text-zinc-400 hover:text-emerald-400 border border-transparent hover:border-emerald-500/30'
)

# Footer
content = content.replace(
    '<div className="bg-white border-t border-dashed border-gray-300 p-6 pb-8 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] sticky bottom-0 z-20">',
    '<div className="bg-zinc-950 border-t border-white/10 p-6 pb-8 shadow-[0_-20px_40px_-15px_rgba(0,0,0,0.5)] sticky bottom-0 z-20">'
)
content = content.replace(
    'text-gray-500 font-mono text-sm',
    'text-zinc-400 font-mono text-sm'
)
content = content.replace(
    'border-t-2 border-gray-900 pt-4',
    'border-t border-white/20 pt-4'
)
content = content.replace(
    'text-gray-900',
    'text-white'
)
content = content.replace(
    'text-2xl tracking-tighter',
    'text-3xl tracking-tighter text-emerald-400'
)
content = content.replace(
    'text-3xl font-bold tabular-nums',
    'text-4xl font-black tabular-nums text-emerald-400 drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]'
)

# Big Buttons
content = content.replace(
    'flex-1 bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20 active:scale-95 touch-manipulation min-h-[48px]',
    'flex-1 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-park-black py-4 rounded-2xl font-black text-lg uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/30 active:scale-95 touch-manipulation min-h-[60px]'
)
content = content.replace(
    'bg-gray-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl font-bold flex justify-center items-center gap-1.5 transition-all shadow-xl shadow-gray-900/20 active:scale-95 text-sm min-h-[48px] touch-manipulation',
    'bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black text-lg uppercase flex justify-center items-center gap-1.5 transition-all shadow-xl shadow-indigo-600/30 active:scale-95 min-h-[60px] touch-manipulation'
)
content = content.replace(
    'bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 border-2 border-gray-900 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm min-h-[48px] touch-manipulation',
    'bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white border-2 border-zinc-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm min-h-[60px] touch-manipulation'
)
content = content.replace(
    'className="bg-amber-50 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed text-amber-700 border border-amber-300 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm min-h-[48px] touch-manipulation"',
    'className="bg-amber-500/20 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed text-amber-400 border border-amber-500/40 py-4 rounded-2xl font-bold flex items-center justify-center gap-1.5 transition-all active:scale-95 text-sm min-h-[60px] touch-manipulation"'
)

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\CheckDetail.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
