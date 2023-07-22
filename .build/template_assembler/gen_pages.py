for i in range(27, 0, -1):
    time = 1690002000 + 7200 * (i - 1)
    page = i
    print(f"""\
    {{
      "name": "book page {page}",
      "enabled_utc": {time},
      "images": [
        "source/book_frame{page:02d}.png"
      ],
      "x": 451,
      "y": 712,
      "priority": 8,
      "autopick": true,
      "export_group": "starter"
    }},\
    """)