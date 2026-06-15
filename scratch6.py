with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\PendingOrdersList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Change the list container to a grid
content = content.replace(
    '<div className="flex-1 overflow-y-auto p-4 space-y-3">',
    '<div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-start content-start">'
)

# Change the card style slightly to look more like a physical ticket
content = content.replace(
    'className={`w-full p-4 rounded-xl border transition-all text-left ${',
    'className={`w-full p-5 rounded-2xl border-2 transition-all text-left flex flex-col h-[180px] shadow-lg ${'
)
content = content.replace(
    '? "bg-indigo-600/20 border-indigo-500 ring-1 ring-indigo-500/50"',
    '? "bg-indigo-500/20 border-indigo-500 ring-2 ring-indigo-500/50 shadow-indigo-500/20"'
)
content = content.replace(
    ': "bg-zinc-900/50 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/50"',
    ': "bg-zinc-900 border-white/5 hover:border-white/20 hover:bg-zinc-800"'
)

# Push the footer to the bottom of the card
content = content.replace(
    '<div className="flex items-center justify-between text-xs text-zinc-500">',
    '<div className="flex items-center justify-between text-xs text-zinc-500 mt-auto pt-3 border-t border-white/5">'
)

# Big status labels
content = content.replace(
    '<span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(order.status)}`}>',
    '<span className={`px-2 py-1 rounded border uppercase tracking-wider text-[10px] font-black ${getStatusColor(order.status)}`}>'
)

# Replace the outer container to remove border-b
content = content.replace(
    '<div className="p-4 space-y-3 border-b border-zinc-800">',
    '<div className="p-4 space-y-4 border-b border-white/5 bg-zinc-900/60">'
)

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\PendingOrdersList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
