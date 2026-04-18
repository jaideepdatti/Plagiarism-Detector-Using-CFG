# 🔍 CFG-Based Plagiarism Detection System

A web-based plagiarism detection tool that compares source code using Context-Free Grammar (CFG) parse trees instead of simple text matching.

## 🚀 Features
- Multi-code comparison (2+ inputs)
- CFG-based parsing and AST generation
- Tree-based similarity (LCS / edit distance)
- DFA-based token validation
- Interactive parse tree visualization
- Detects variable renaming and structural similarity

## 🛠️ Tech Stack
- HTML, CSS, JavaScript
- Custom CFG Parser (Recursive Descent)
- SVG for tree visualization

## ⚙️ How It Works
1. Tokenize input code  
2. Normalize identifiers and constants  
3. Parse using CFG → generate AST  
4. Compare trees → compute similarity  
5. Display score + explanation  

## 📊 Similarity Scale
- 90–100% → High similarity  
- 70–89%  → Moderate  
- 40–69%  → Partial  
- <40%    → Low  

## ⚠️ Limitations
- Based on syntax, not full semantics  
- Different constructs (e.g., for vs map) may reduce score  

## 📌 Usage
1. Paste or upload code  
2. Add multiple panels  
3. Click **Analyze**  
4. View results (score, AST, tokens, DFA)

## 👨‍💻 
Theory of Computation project using CFG, PDA concepts
