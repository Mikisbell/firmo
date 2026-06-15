with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\CategoryTabs.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_button = """                    <motion.button
                        key={cat.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectCategory(cat.id)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                            isSelected
                                ? `${cat.color} text-white shadow-lg`
                                : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white"
                        }`}
                    >
                        <cat.icon size={16} />
                        <span>{cat.label}</span>
                        {count > 0 && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                isSelected ? "bg-white/20" : "bg-zinc-700"
                            }`}>
                                {count}
                            </span>
                        )}
                    </motion.button>"""

new_button = """                    <motion.button
                        key={cat.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => onSelectCategory(cat.id)}
                        className={`flex items-center justify-center gap-2 px-6 py-4 rounded-xl text-base font-bold whitespace-nowrap transition-all border-b-4 ${
                            isSelected
                                ? `${cat.color} text-white border-black/20 shadow-md`
                                : "bg-zinc-800 text-zinc-400 border-zinc-950 hover:bg-zinc-700 hover:text-white hover:border-zinc-900"
                        }`}
                    >
                        <cat.icon size={20} />
                        <span className="tracking-wide uppercase">{cat.label}</span>
                        {count > 0 && (
                            <span className={`text-xs px-2 py-0.5 rounded font-black ${
                                isSelected ? "bg-black/30 text-white" : "bg-zinc-900 text-zinc-500"
                            }`}>
                                {count}
                            </span>
                        )}
                    </motion.button>"""

content = content.replace(old_button, new_button)

with open(r'e:\FREECLOUD\FREECLOUD-IA\PROYECTOS\park\src\app\pos\components\CategoryTabs.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
