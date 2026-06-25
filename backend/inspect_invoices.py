import re
from bs4 import BeautifulSoup

def inspect():
    with open('c:/Desktop/ALGONOX/SECRETARY/backend/billing-invoice-debug.html', 'r', encoding='utf-8') as f:
        html = f.read()
    
    soup = BeautifulSoup(html, 'html.parser')
    
    print("Searching for 'Invoice History'...")
    # Find the link or heading that has Invoice History
    target = soup.find(string=re.compile("Invoice History", re.I))
    if not target:
        print("Could not find 'Invoice History' string.")
        return
        
    print("Found string:", target)
    # Let's traverse up to a container or print sibling tags
    curr = target
    for _ in range(5):
        if curr.parent:
            curr = curr.parent
            print(f"Parent tag: {curr.name}, classes: {curr.get('class')}")
            
    # Let's search for table, list, or row elements in the page
    print("\nLooking for tables or table rows:")
    tables = soup.find_all('table')
    print(f"Found {len(tables)} tables.")
    for idx, table in enumerate(tables):
        print(f"Table {idx+1} classes: {table.get('class')}")
        rows = table.find_all('tr')
        print(f"Table {idx+1} has {len(rows)} rows.")
        for r_idx, r in enumerate(rows[:5]):
            print(f"  Row {r_idx+1}: {' '.join(r.get_text().split())}")
            
    # Let's print any text containing month and year
    print("\nSearching for any text matching month and year:")
    months_re = re.compile(r"\b(January|February|March|April|May|June|July|August|September|October|November|December)\b\s+\d{4}", re.I)
    matches = soup.find_all(string=months_re)
    print(f"Found {len(matches)} text matches for months:")
    for m in matches[:15]:
        print(f"Match: '{' '.join(m.split())}' | Parent: {m.parent.name} | Grandparent: {m.parent.parent.name}")

if __name__ == '__main__':
    inspect()
