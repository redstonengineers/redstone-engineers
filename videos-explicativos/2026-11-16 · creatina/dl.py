import subprocess,sys,os,json
B="https://elevenlabsusercontent.com/database/workspace/ede74c4953994efdaf7b807eedadf185/content_generation/%s/%s/content.png?Expires=1794866400&KeyName=assets-cdn-key-1&Signature=%s"
L = {
"I01":("CV6JZjs5bVZ0Nntewt3O","0TyLEZXE4kLtnDjalLOA","VTTQUv9PfyZY_pzY6x_ErkPczlo="),
"I02":("oUFNNQszHIt685UNwZoM","fwRdE9mp4AH1T2GRZlMZ","xpTenk4RlX_d3DGPmTrIiRYx6oM="),
"I03":("jNVU3zi2ppXOJr2ikZz1","kGr3c80XkUt5bQFgKlgP","uPnkTUzHfcZaAV9_0aWxqTM8EO4="),
"I04":("oSvf6EsOJUhnmzn9mU65","0TpoY7zI8CB9TvVeLomU","tw5gXkTI-IJJsB7V_AuAoVoaxm8="),
"I05":("N6opJFJZEsPvQvZzhJrY","vWOiWw1pCGC3vbPgYlJV","GbJhbn03QIwHGZCMkG_70PgGsTk="),
"I06":("Frw6egUvP6zNxp1Ee7Uw","Wfc8RoZZM4tFZMNcLRYk","EF8AGopvSfCITlFOeHZUUA55yqU="),
"I08":("qZupz3O09AysW11CN0fD","QG4gCOiE35lT6Kok4lRC","UlK8BL35dTmaJUuTKbXKUVUVvqA="),
"I09":("Hh6aBev7bc0wzzOkmPiC","fdlMmu5n65ivb8V8CyLM","N3gIF1IlkLL6AGPSUVkS9NGcLmE="),
"I10":("5wqjskraznToC5JPRuK3","PScZQkuC7HGf4lGa3sAp","3JrLElrtMTHbyE4JlLfSzea7HqQ="),
"I11":("ZqjRJh9S7UAOYZCBkWa4","cjUVidlUClOLBvzPDLBe","tVCfC3lEOCumN-0vb3K2T3U2P3I="),
"I12":("ZaT6vN1U7cazs0T9RJJj","E5N1Y59dYlZ1L2wa9jfD","K7Ho1XrM52p8jM7xJlYhUQVfnJ4="),
"I13":("02ebYQo4HtoAHmeX5qX7","WmG7jP07KgT8MXaGb8OF","9dFGzDMAQW8RCDdJ9YBQYIWAZIg="),
"I14":("8J0eUl1WFPxoCUKl2YQ6","M6dcrNwaLHKH0Ps2oi1S","16l4IyJMB1qUvIqXkuEEqaQSNjY="),
"I15":("aw0nA0lp9z71zdqAg4N4","ZwAsc1sDAic5aX0Xl5Pq","BKr_r_vIrAlK0fPm3xQTbtm_qXU="),
"I16":("MdU6TQTw4o2cQp0jzIIU","A7PzqNM2WDClm8mxDzca","FUYL2_heTF1KjM3oipWT5jLE-CI="),
"I17":("i3TrnhfexLZHx9Y8GvqL","oWyFsyTJhsqRXzEYkkHF","7f7b4XxJ31hh6vSkYPyPEDjqyDY="),
"I18":("wNjZHmHkeL8TnmBe5eBa","yja2dXsQ3s0SXW0IDZUS","D18Lvu4cBx_BpjSlXICrcLESKz8="),
"I19":("1QiYA1q7N0wWu6yLci2t","sjn7zyBdXwbjbpGNWGYL","XX2q72M5wNe2wN9KvmLQVGnKANk="),
"I20":("2swpT4xufKPQhiNQEVMa","TTFWeJevqu98v5xsTcvW","UPNR6NPNkuZDyIN02vmH7RTf9rY="),
"I21":("cgyRapjDe6ZIPsZ8UAAB","J6LjPh2u3Ten2WJTZ9JH","RuehnCnAqj9oVoKxvAxjYBXq6kM="),
"I22":("vlXWspLg7MD5639qXNFg","hEVIvjx9VKj3QShrP1rf","Ax4rc07ye_J5vysAT0rfOa4adOU="),
"I23":("QYSiEF1qEdjPhgAzsoNa","HUFCD6jtsixskgZM3vKa","quTY8YIhnGFgOxBVNenJ_sQudkY="),
"I24":("5hTCrFVX0SnhzjJJhhfx","Ip0H87l86diukAI8AQhH","-nUj9bsL5IuBRnKbM5dPmO_nRa0="),
"I25":("BFNTrM5mcVRZpiGH0ACy","P8dGvNT9f5Gy4ZIiNAon","d7hZjO2T0TK27WzWvkNPvgFb79w="),
"I26":("qtftpDdhb3RSKoFX6Bbj","ndG8RpK0EjvFriAPqxI7","fNzFaim4lc6-JFnhugge6W2qGo8="),
"I27":("VbUfqTsAnEBkgVepLYfy","oiH3AzaYN7VqYCwZXFlO","lIbHQrqN4nVfOGixhu7lNXCqkm8="),
"I28":("W5KRsVrvQIpwvftQxfCn","DdxPl4h8HxRrJGUkpYzq","nH2yHdMSxtzhSECFpmJsrc0cUgs="),
"I29":("XlxlYo1yntyvNLeFq8FK","yb1Oyiq6FO6FhTfMFhty","hRUWhylJZJNGBmjq0LCZ_U4Wrww="),
"I30":("krUZOYkizY8OnGeDLVsi","MGLqpskSJYeeDn39ZyBv","rzoRMfTUyP8lGKpGG00VoI6EEic="),
"I31":("CWnAkrr8lCSatj2RDAWs","cZuSmVJ9uI7tx4PRqyIz","bDcU7Qbz5tBsnJy6YrfyOtHOV1E="),
"I32":("5VCzM0wCOWv8FgX7VHK5","rNi7hquCwdyxmPh5Bq15","oUJKumwNzArpZspoai42pGWmkbY="),
"I33":("7HMiR4L7van1XGRYCtxD","5880h6G2kvxaxAISwCVK","J5EIz6twm9ry4LjMzEAifu2I5yA="),
"I34":("zAz1UNQmUL9EDR4bVyZZ","RziIiU5EKmiW7XJ4y05Q","GPtDrFXmKW4Scv1y5vmeh08gihs="),
"I35":("BmnpnOmBzgmxOHiKQarL","bCafuxdpPmJvvvnbPpA9","3XKdp-l-bnIfd02WdVRtyokz1nQ="),
"I36":("uGj30KUGyX75bVNIVwsT","Hc55ENG6wjStdKqXhzY9","4v3w-m6PG5e79ILxecP7NzzSCMM="),
"I37":("4VewZgAyq7a7nQSRORa5","KgcupjeHdYwI6p1nSxpI","ksBwHfTMSc5mIpAZZ7Qf94H3pX4="),
"I38":("GhH0j20RQodJQ0Nep8MJ","hZm9VHzaLEuOb0mnj9pI","A7Z1LZq9hbN0Y1mNR6hY6COg8O4="),
"I39":("SB8hZ2Fyc3R5qu9fL1C4","stt6yjbOTdZn5qysmtAe","x66e7rs2pqp35iiCKjs9KkSSYjQ="),
"I40":("IAtgKjg9MPEkJVzKt7Gh","DUzmyQP3PXeGAWreBxSC","3tRDW_n89y0A8zLmaXcL0d0AAg8="),
"I41":("qMfKSWP4w7MgJMwJ7FQK","fNM8fXxV61h5irEHSFuy","mNkVRosN6ZvJIj5kXcrAIubH-n8="),
"I42":("lZjOUIbRNiIHakVw8BR5","B5BUbkmevbLLwHHhdeZx","JFwK08IC3GPvgUqvJcpgFtiuVLY="),
"I43":("HykGvejkMmpHnvmAEF47","JSk0oFzMSE7NGFc8fih6","ybXJQZFPgN8_ycvXR_3MsIgKGCc="),
"I44":("W4r4tP0M9ci4gi7RECgb","6DeFVYYi5NzAGJnUyb0H","UTeU6VciFvJLhF_wFPY1-P4zvRk="),
"I45":("QhLDuQhmLac0PsodEpr8","XhSzahSkswMXA7oxQMGU","_YzA0vW_lFH4AefQ0KNgTxVxp1s="),
"I46":("kF4L4Bjm2Cixw3O7euLQ","OmU7bPa1HTmQgHhbw3oL","NcIiowqUnWZnTEnefZVMpbV8cZ0="),
"I47":("rOtuvHWU22CkXRQtbr32","DVZoBqH5RUqSUENSaVAU","SEFRK3LsC7puQnjPbJi1POzUT18="),
"I48":("UF0sUkLx0IPEdmUBjU6m","EmDBT7w5rN2L1bwiTRgg","a6sLen_rR3pKCSle0ElnI32xhHI="),
"I49":("ufyHBCbY4aStGx4d1lX9","oT0IHCWN46Bo6K6WyX1o","ZQA8sjv9o0uql0GtCwGlZx5EvPs="),
"I50":("yKyfUFcBK5yT9zdgZGKx","HW96pCEklMRgEYykfPnM","bZTGJzfKXM5dse9KOF9SXCbbOTM="),
"I51":("jVBEiMfs4L4axCIFwg5z","3pytq1JshVgIWeQQxOoe","B9yPdYw9s7zdtb26JiIwa22X_sI="),
}
bad=[]
for k,(s,g,sig) in L.items():
    f=f"img/{k}.png"
    if os.path.exists(f) and os.path.getsize(f)>50000: continue
    subprocess.run(["curl","-sS","-m","90","-o",f,B%(s,g,sig)])
    ok=os.path.exists(f) and os.path.getsize(f)>50000
    if not ok: bad.append(k)
print("descargadas",len(L)-len(bad),"fallidas",bad)
